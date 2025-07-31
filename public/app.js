document.addEventListener('DOMContentLoaded', function() {
    const apiBaseUrl = window.location.origin + '/api';

    const loadingScreen = document.getElementById('loadingScreen');
    const mainContent = document.getElementById('mainContent');
    const errorScreen = document.getElementById('errorScreen');
    const errorMessage = document.getElementById('errorMessage');
    const adventuresList = document.getElementById('adventuresList');
    const partySection = document.getElementById('partySection');
    const partyList = document.getElementById('partyList');
    const characterModal = document.getElementById('characterModal');
    const characterDetails = document.getElementById('characterDetails');

    const retryButton = document.getElementById('retryButton');
    retryButton.addEventListener('click', fetchAdventures);

    const refreshButton = document.getElementById('refreshButton');
    refreshButton.addEventListener('click', fetchAdventures);

    const backToAdventuresButton = document.getElementById('backToAdventures');
    backToAdventuresButton.addEventListener('click', showAdventuresList);

    const closeModalButton = document.getElementById('closeModal');
    closeModalButton.addEventListener('click', hideCharacterModal);

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

    function fetchAdventures() {
        setLoadingScreen(true);
        setErrorScreen(false);

        fetch(`${apiBaseUrl}/adventures`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    displayAdventures(data.adventures);
                    setLoadingScreen(false);
                } else {
                    setErrorScreen(true, 'Failed to load adventures');
                }
            })
            .catch(error => {
                console.error('Error fetching adventures:', error);
                setErrorScreen(true, 'Failed to load adventures');
            });
    }

    function displayAdventures(adventures) {
        adventuresList.innerHTML = '';

        if (adventures.length === 0) {
            adventuresList.innerHTML = '<p>No active adventures.</p>';
            return;
        }

        adventures.forEach(adventure => {
            const adventureDiv = document.createElement('div');
            adventureDiv.className = 'adventure';
            adventureDiv.innerHTML = `
                <div class="adventure-header">
                    🗡️ ${adventure.adventure_id} - ${adventure.participant_count} участник(и)
                </div>
                <button class="view-party-button" data-id="${adventure.adventure_id}">Посмотреть Группу</button>
            `;
            adventuresList.appendChild(adventureDiv);

            // Add event listener
            adventureDiv.querySelector('.view-party-button').addEventListener('click', () => {
                fetchParty(adventure.adventure_id);
            });
        });
    }

    function fetchParty(adventureId) {
        setLoadingScreen(true);
        fetch(`${apiBaseUrl}/adventures/${adventureId}/party`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showPartySection(data.party);
                    setLoadingScreen(false);
                } else {
                    setErrorScreen(true, 'Failed to load party members');
                }
            })
            .catch(error => {
                console.error('Error fetching party members:', error);
                setErrorScreen(true, 'Failed to load party members');
            });
    }

    function showPartySection(party) {
        partySection.style.display = 'block';
        adventuresList.style.display = 'none';
        partyList.innerHTML = '';

        party.forEach(member => {
            const partyMemberDiv = document.createElement('div');
            partyMemberDiv.className = 'party-member';
            partyMemberDiv.innerHTML = `
                <p>👤 <b>${member.name}</b> (Lv. ${member.level})</p>
                <p>⚔️ ${member.class_name}</p>
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
    let refreshInterval;
    
    function startAutoRefresh() {
        refreshInterval = setInterval(() => {
            if (document.getElementById('adventuresSection').style.display !== 'none') {
                fetchAdventures();
            }
        }, 3000);
    }
    
    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    }
    
    // Update last update time
    function updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        document.getElementById('lastUpdate').textContent = timeString;
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
    
    // Override fetch functions to update connection status and time
    const originalFetchAdventures = fetchAdventures;
    fetchAdventures = function() {
        originalFetchAdventures();
        updateLastUpdateTime();
        updateConnectionStatus(true);
    };
    
    // Initial fetch and start auto-refresh
    fetchAdventures();
    startAutoRefresh();
    
    // Stop auto-refresh when page is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoRefresh();
        } else {
            startAutoRefresh();
        }
    });
});

