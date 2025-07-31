document.addEventListener('DOMContentLoaded', function() {
    const apiBaseUrl = window.location.origin + '/api';

    const loadingScreen = document.getElementById('loadingScreen');
    const mainContent = document.getElementById('mainContent');
    const errorScreen = document.getElementById('errorScreen');
    const errorMessage = document.getElementById('errorMessage');
    const myCharacterButton = document.getElementById('myCharacterButton');
    const activePartyButton = document.getElementById('activePartyButton');
    const mainButtonsSection = document.getElementById('mainButtonsSection');
    const partySection = document.getElementById('partySection');
    const partyList = document.getElementById('partyList');
    const characterModal = document.getElementById('characterModal');
    const characterDetails = document.getElementById('characterDetails');

    const retryButton = document.getElementById('retryButton');
    retryButton.addEventListener('click', () => showMainButtons());

    const backToAdventuresButton = document.getElementById('backToAdventures');
    backToAdventuresButton.addEventListener('click', showMainButtons);

    const closeModalButton = document.getElementById('closeModal');
    closeModalButton.addEventListener('click', hideCharacterModal);

    // Event listeners for main buttons
    myCharacterButton.addEventListener('click', fetchMyCharacter);
    activePartyButton.addEventListener('click', fetchActiveParty);

    // Auto-refresh interval
    let refreshInterval;
    
    // Get user ID from Telegram WebApp
    function getUserId() {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe.user) {
            return window.Telegram.WebApp.initDataUnsafe.user.id;
        }
        return '123456789'; // Fallback for testing
    }

    function setLoadingScreen(loading) {
        loadingScreen.style.display = loading ? 'flex' : 'none';
        mainContent.style.display = loading ? 'none' : 'block';
    }

    function setErrorScreen(error, message = 'An error occurred') {
        errorScreen.style.display = error ? 'block' : 'none';
        loadingScreen.style.display = error ? 'none' : 'none';
        mainContent.style.display = error ? 'none' : 'block';
        errorMessage.textContent = message;
    }

    function fetchMyCharacter() {
        setLoadingScreen(true);
        setErrorScreen(false);
        
        const userId = getUserId();
        fetch(`${apiBaseUrl}/my-character?user_id=${userId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (data.character) {
                        showCharacterModal(data.character);
                        startAutoRefresh(); // Start auto-refresh on character screen
                    } else {
                        alert('У вас нет активного персонажа');
                    }
                    setLoadingScreen(false);
                } else {
                    setErrorScreen(true, 'Failed to load your character');
                }
            })
            .catch(error => {
                console.error('Error fetching character:', error);
                setErrorScreen(true, 'Failed to load your character');
            });
    }

    function fetchActiveParty() {
        setLoadingScreen(true);
        setErrorScreen(false);
        
        fetch(`${apiBaseUrl}/adventures`)
            .then(response => response.json())
            .then(data => {
                console.log('Adventures response:', data);
                if (data.success && data.adventures.length > 0) {
                    const activeAdventure = data.adventures[0]; // Get first active adventure
                    console.log('Using adventure:', activeAdventure);
                    fetchParty(activeAdventure.adventure_id);
                } else {
                    console.log('No adventures found or failed');
                    setLoadingScreen(false);
                    setErrorScreen(true, 'No active adventures found');
                }
            })
            .catch(error => {
                console.error('Error fetching adventures:', error);
                setLoadingScreen(false);
                setErrorScreen(true, 'Failed to load adventures');
            });
    }

    function showMainButtons() {
        mainButtonsSection.style.display = 'block';
        partySection.style.display = 'none';
        characterModal.style.display = 'none';
        stopAutoRefresh(); // Stop auto-refresh on main screen
        updateConnectionStatus(true);
    }

    function fetchParty(adventureId) {
        setLoadingScreen(true);
        console.log('Fetching party for adventure:', adventureId);
        fetch(`${apiBaseUrl}/adventures/${adventureId}/party`)
            .then(response => {
                console.log('Party response status:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('Party response data:', data);
                if (data.success) {
                    showPartySection(data.party);
                    setLoadingScreen(false);
                } else {
                    console.error('Party fetch failed:', data.error);
                    setLoadingScreen(false);
                    setErrorScreen(true, `Failed to load party members: ${data.error || 'Unknown error'}`);
                }
            })
            .catch(error => {
                console.error('Error fetching party members:', error);
                setLoadingScreen(false);
                setErrorScreen(true, `Failed to load party members: ${error.message}`);
            });
    }

    function showPartySection(party) {
        mainButtonsSection.style.display = 'none';
        partySection.style.display = 'block';
        partyList.innerHTML = '';
        startAutoRefresh(); // Start auto-refresh on party screen

        party.forEach(member => {
            const playerName = member.username || member.first_name || `User ${member.user_id}`;
            const partyMemberDiv = document.createElement('div');
            partyMemberDiv.className = 'party-member';
            partyMemberDiv.innerHTML = `
                <div class="member-info">
                    <p>👤 <b>${member.name}</b> (Lv. ${member.level})</p>
                    <p>⚔️ ${member.class_name}</p>
                    <p class="player-name">🎮 ${playerName}</p>
                </div>
                <button class="view-character-button" data-id="${member.character_id}">Детали</button>
            `;
            partyList.appendChild(partyMemberDiv);

            // Add event listener
            partyMemberDiv.querySelector('.view-character-button').addEventListener('click', () => {
                fetchCharacterDetails(member.character_id);
            });
        });
    }

    function fetchCharacterDetails(characterId) {
        setLoadingScreen(true);
        fetch(`${apiBaseUrl}/characters/${characterId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showCharacterModal(data.character);
                    setLoadingScreen(false);
                } else {
                    setErrorScreen(true, 'Failed to load character details');
                }
            })
            .catch(error => {
                console.error('Error fetching character details:', error);
                setErrorScreen(true, 'Failed to load character details');
            });
    }

    function showCharacterModal(character) {
        // Calculate ability modifiers
        const getModifier = (stat) => Math.floor((stat - 10) / 2);
        
        // Format stats with modifiers  
        const statEmojis = {
            strength: '🐂',
            dexterity: '🐱', 
            constitution: '🐻',
            intelligence: '🦊',
            wisdom: '🦉',
            charisma: '🦅'
        };
        
        const statNames = {
            strength: 'Сила',
            dexterity: 'Ловкость',
            constitution: 'Телосложение',
            intelligence: 'Интеллект', 
            wisdom: 'Мудрость',
            charisma: 'Харизма'
        };
        
        let statsHtml = '<div class="character-stats"><h3>📊 Характеристики:</h3>';
        for (const [statKey, statName] of Object.entries(statNames)) {
            const value = character[statKey] || 10;
            const modifier = getModifier(value);
            const emoji = statEmojis[statKey];
            statsHtml += `<p>${emoji} <b>${statName}:</b> ${value} (${modifier >= 0 ? '+' : ''}${modifier})</p>`;
        }
        statsHtml += '</div>';
        
        // Equipment display
        let equipmentHtml = '<div class="character-equipment"><h3>🎒 Экипировка:</h3>';
        if (character.equipment && character.equipment.length > 0) {
            character.equipment.forEach(item => {
                if (item.item_type === 'armor') {
                    equipmentHtml += `<p>🛡️ <b>Доспехи:</b> ${item.item_name}</p>`;
                } else if (item.item_type === 'weapon') {
                    const damageText = item.damage && item.damage_type ? ` (${item.damage} ${item.damage_type})` : '';
                    equipmentHtml += `<p>⚔️ <b>Оружие:</b> ${item.item_name}${damageText}</p>`;
                }
            });
        } else {
            equipmentHtml += '<p>Нет экипировки</p>';
        }
        equipmentHtml += '</div>';
        
        // Spells display
        let spellsHtml = '';
        if (character.is_spellcaster && character.spells && character.spells.length > 0) {
            spellsHtml = '<div class="character-spells"><h3>📜 Заклинания:</h3>';
            const spellsByLevel = {};
            character.spells.forEach(spell => {
                const level = spell.level;
                if (!spellsByLevel[level]) spellsByLevel[level] = [];
                spellsByLevel[level].push(spell.name);
            });
            
            Object.keys(spellsByLevel).sort((a, b) => a - b).forEach(level => {
                const levelName = level == 0 ? 'Заговоры' : `${level} уровень`;
                spellsHtml += `<p><b>${levelName}:</b> ${spellsByLevel[level].join(', ')}</p>`;
            });
            spellsHtml += '</div>';
        }
        
        characterDetails.innerHTML = `
            <div class="character-basic-info">
                <p>👤 <b>Имя:</b> ${character.name}</p>
                <p>🧝‍♂️ <b>Раса:</b> ${character.race_name}</p>
                <p>🎭 <b>Происхождение:</b> ${character.origin_name}</p>
                <p>⚔️ <b>Класс:</b> ${character.class_name}</p>
                <p>📊 <b>Уровень:</b> ${character.level}</p>
                <p>⭐ <b>Опыт:</b> ${character.experience}</p>
                <p>❤️ <b>Очки здоровья:</b> ${character.hit_points}/${character.max_hit_points}</p>
                <p>💰 <b>Деньги:</b> ${character.money} монет</p>
                <p>🎯 <b>Бонус мастерства:</b> +${character.proficiency_bonus}</p>
            </div>
            
            <div class="character-skills">
                <h3>🎯 Навыки:</h3>
                <p>${character.skills && character.skills.length > 0 ? character.skills.join(', ') : 'Нет навыков'}</p>
            </div>
            
            ${statsHtml}
            ${equipmentHtml}
            ${spellsHtml}
        `;
        characterModal.style.display = 'block';
    }

    function hideCharacterModal() {
        characterModal.style.display = 'none';
    }

    function showAdventuresList() {
        partySection.style.display = 'none';
        adventuresList.style.display = 'block';
    }

    // Auto-refresh every 3 seconds
    function startAutoRefresh() {
        refreshInterval = setInterval(() => {
            // Only refresh when on character or party screens
            if (partySection.style.display === 'block') {
                // Re-fetch the current party data
                const userId = getUserId();
                fetchActiveParty();
            } else if (characterModal.style.display === 'block') {
                // Re-fetch character data if it's the user's own character
                const userId = getUserId();
                fetchMyCharacter();
            }
        }, 3000);
    }
    
    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    }
    
    // Connection status indicator
    function updateConnectionStatus(connected) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        
        if (connected) {
            statusIndicator.style.backgroundColor = '#28a745';
            statusText.textContent = 'Connected';
        } else {
            statusIndicator.style.backgroundColor = '#dc3545';
            statusText.textContent = 'Disconnected';
        }
    }
    
    // Initialize the app
    setLoadingScreen(false);
    showMainButtons();
    
    // Stop auto-refresh when page is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoRefresh();
        } else {
            if (partySection.style.display === 'block' || characterModal.style.display === 'block') {
                startAutoRefresh();
            }
        }
    });
});

