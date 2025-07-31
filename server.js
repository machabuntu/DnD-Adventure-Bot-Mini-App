const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
};

// Database connection pool
const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Rate limiting - disabled for auto-refresh
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000, // Very high limit
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

// Middleware
// app.use(limiter); // Disabled for development
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes

// Get all active adventures with their participants
app.get('/api/adventures', async (req, res) => {
    try {
        const [adventures] = await pool.execute(`
            SELECT 
                a.id as adventure_id,
                a.chat_id,
                a.status,
                a.created_at,
                COUNT(ap.character_id) as participant_count
            FROM adventures a
            LEFT JOIN adventure_participants ap ON a.id = ap.adventure_id
            WHERE a.status = 'active'
            GROUP BY a.id, a.chat_id, a.status, a.created_at
            ORDER BY a.created_at DESC
        `);

        res.json({
            success: true,
            adventures: adventures
        });
    } catch (error) {
        console.error('Error fetching adventures:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch adventures' 
        });
    }
});

// Get party members for a specific adventure
app.get('/api/adventures/:adventureId/party', async (req, res) => {
    try {
        const { adventureId } = req.params;
        
        const [partyMembers] = await pool.execute(`
            SELECT 
                c.id as character_id,
                c.name,
                c.level,
                c.experience,
                c.user_id,
                u.first_name,
                u.username,
                c.hit_points,
                c.max_hit_points,
                c.strength,
                c.dexterity,
                c.constitution,
                c.intelligence,
                c.wisdom,
                c.charisma,
                c.money,
                r.name as race_name,
                o.name as origin_name,
                cl.name as class_name,
                cl.hit_die,
                cl.is_spellcaster,
                l.proficiency_bonus,
                ap.joined_at
            FROM adventure_participants ap
            INNER JOIN characters c ON ap.character_id = c.id
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN races r ON c.race_id = r.id
            LEFT JOIN origins o ON c.origin_id = o.id
            LEFT JOIN classes cl ON c.class_id = cl.id
            LEFT JOIN levels l ON c.level = l.level
            WHERE ap.adventure_id = ?
            ORDER BY c.name
        `, [adventureId]);

        // Get skills for each character
        for (let member of partyMembers) {
            const [skills] = await pool.execute(`
                SELECT skill_name 
                FROM character_skills 
                WHERE character_id = ?
            `, [member.character_id]);
            
            member.skills = skills.map(skill => skill.skill_name);

            // Get equipment
            const [equipment] = await pool.execute(`
                SELECT 
                    ce.item_type, 
                    ce.item_id, 
                    ce.is_equipped,
                    CASE 
                        WHEN ce.item_type = 'armor' THEN a.name
                        WHEN ce.item_type = 'weapon' THEN w.name
                    END as item_name,
                    CASE 
                        WHEN ce.item_type = 'weapon' THEN w.damage
                        ELSE NULL
                    END as damage,
                    CASE 
                        WHEN ce.item_type = 'weapon' THEN w.damage_type
                        ELSE NULL
                    END as damage_type,
                    CASE 
                        WHEN ce.item_type = 'armor' THEN a.armor_class
                        ELSE NULL
                    END as armor_class
                FROM character_equipment ce
                LEFT JOIN armor a ON ce.item_type = 'armor' AND ce.item_id = a.id
                LEFT JOIN weapons w ON ce.item_type = 'weapon' AND ce.item_id = w.id
                WHERE ce.character_id = ?
            `, [member.character_id]);
            
            member.equipment = equipment;

            // Get spells if spellcaster
            if (member.is_spellcaster) {
                const [spells] = await pool.execute(`
                    SELECT s.name, s.level, s.damage, s.damage_type
                    FROM character_spells cs
                    JOIN spells s ON cs.spell_id = s.id
                    WHERE cs.character_id = ?
                    ORDER BY s.level, s.name
                `, [member.character_id]);
                
                member.spells = spells;
            } else {
                member.spells = [];
            }
        }

        res.json({
            success: true,
            party: partyMembers
        });
    } catch (error) {
        console.error('Error fetching party:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch party members' 
        });
    }
});

// Get current user's character (for Telegram Mini App)
app.get('/api/my-character', async (req, res) => {
    try {
        // Get user_id from Telegram Mini App init data or query parameter
        const userId = req.query.user_id;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }
        
        // Get the user's most recent active character
        const [characters] = await pool.execute(`
            SELECT 
                c.id as character_id,
                c.name,
                c.level,
                c.experience,
                c.user_id,
                c.hit_points,
                c.max_hit_points,
                c.strength,
                c.dexterity,
                c.constitution,
                c.intelligence,
                c.wisdom,
                c.charisma,
                c.money,
                r.name as race_name,
                o.name as origin_name,
                cl.name as class_name,
                cl.hit_die,
                cl.is_spellcaster,
                l.proficiency_bonus,
                c.created_at
            FROM characters c
            LEFT JOIN races r ON c.race_id = r.id
            LEFT JOIN origins o ON c.origin_id = o.id
            LEFT JOIN classes cl ON c.class_id = cl.id
            LEFT JOIN levels l ON c.level = l.level
            WHERE c.user_id = ? AND c.is_active = TRUE
            ORDER BY c.created_at DESC
            LIMIT 1
        `, [userId]);
        
        if (characters.length === 0) {
            return res.json({
                success: true,
                character: null,
                message: 'No active character found for this user'
            });
        }
        
        const character = characters[0];
        
        // Get skills
        const [skills] = await pool.execute(`
            SELECT skill_name 
            FROM character_skills 
            WHERE character_id = ?
        `, [character.character_id]);
        
        character.skills = skills.map(skill => skill.skill_name);
        
        // Get equipment
        const [equipment] = await pool.execute(`
            SELECT 
                ce.item_type, 
                ce.item_id, 
                ce.is_equipped,
                CASE 
                    WHEN ce.item_type = 'armor' THEN a.name
                    WHEN ce.item_type = 'weapon' THEN w.name
                END as item_name,
                CASE 
                    WHEN ce.item_type = 'weapon' THEN w.damage
                    ELSE NULL
                END as damage,
                CASE 
                    WHEN ce.item_type = 'weapon' THEN w.damage_type
                    ELSE NULL
                END as damage_type,
                CASE 
                    WHEN ce.item_type = 'armor' THEN a.armor_class
                    ELSE NULL
                END as armor_class
            FROM character_equipment ce
            LEFT JOIN armor a ON ce.item_type = 'armor' AND ce.item_id = a.id
            LEFT JOIN weapons w ON ce.item_type = 'weapon' AND ce.item_id = w.id
            WHERE ce.character_id = ?
        `, [character.character_id]);
        
        character.equipment = equipment;
        
        // Get spells if spellcaster
        if (character.is_spellcaster) {
            const [spells] = await pool.execute(`
                SELECT s.name, s.level, s.damage, s.damage_type, s.description
                FROM character_spells cs
                JOIN spells s ON cs.spell_id = s.id
                WHERE cs.character_id = ?
                ORDER BY s.level, s.name
            `, [character.character_id]);
            
            character.spells = spells;
        } else {
            character.spells = [];
        }
        
        res.json({
            success: true,
            character: character
        });
    } catch (error) {
        console.error('Error fetching current user character:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch character details' 
        });
    }
});

// Get detailed character information
app.get('/api/characters/:characterId', async (req, res) => {
    try {
        const { characterId } = req.params;
        
        const [characters] = await pool.execute(`
            SELECT 
                c.*,
                r.name as race_name,
                o.name as origin_name,
                cl.name as class_name,
                cl.hit_die,
                cl.is_spellcaster,
                l.proficiency_bonus
            FROM characters c
            LEFT JOIN races r ON c.race_id = r.id
            LEFT JOIN origins o ON c.origin_id = o.id
            LEFT JOIN classes cl ON c.class_id = cl.id
            LEFT JOIN levels l ON c.level = l.level
            WHERE c.id = ? AND c.is_active = TRUE
        `, [characterId]);

        if (characters.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Character not found'
            });
        }

        const character = characters[0];

        // Get skills
        const [skills] = await pool.execute(`
            SELECT skill_name 
            FROM character_skills 
            WHERE character_id = ?
        `, [characterId]);
        
        character.skills = skills.map(skill => skill.skill_name);

        // Get equipment
        const [equipment] = await pool.execute(`
            SELECT 
                ce.item_type, 
                ce.item_id, 
                ce.is_equipped,
                CASE 
                    WHEN ce.item_type = 'armor' THEN a.name
                    WHEN ce.item_type = 'weapon' THEN w.name
                END as item_name,
                CASE 
                    WHEN ce.item_type = 'weapon' THEN w.damage
                    ELSE NULL
                END as damage,
                CASE 
                    WHEN ce.item_type = 'weapon' THEN w.damage_type
                    ELSE NULL
                END as damage_type,
                CASE 
                    WHEN ce.item_type = 'armor' THEN a.armor_class
                    ELSE NULL
                END as armor_class
            FROM character_equipment ce
            LEFT JOIN armor a ON ce.item_type = 'armor' AND ce.item_id = a.id
            LEFT JOIN weapons w ON ce.item_type = 'weapon' AND ce.item_id = w.id
            WHERE ce.character_id = ?
        `, [characterId]);
        
        character.equipment = equipment;

        // Get spells if spellcaster
        if (character.is_spellcaster) {
            const [spells] = await pool.execute(`
                SELECT s.name, s.level, s.damage, s.damage_type, s.description
                FROM character_spells cs
                JOIN spells s ON cs.spell_id = s.id
                WHERE cs.character_id = ?
                ORDER BY s.level, s.name
            `, [characterId]);
            
            character.spells = spells;
        } else {
            character.spells = [];
        }

        res.json({
            success: true,
            character: character
        });
    } catch (error) {
        console.error('Error fetching character:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch character details' 
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await pool.execute('SELECT 1');
        res.json({ 
            success: true, 
            status: 'Database connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            status: 'Database connection failed',
            error: error.message 
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`D&D Bot Mini App server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Test database connection
    pool.execute('SELECT 1')
        .then(() => console.log('✅ Database connected successfully'))
        .catch(err => console.error('❌ Database connection failed:', err.message));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    pool.end();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    pool.end();
    process.exit(0);
});
