const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const UPLOADS_FILE = path.join(DATA_DIR, 'uploads.json');

// Initialize database files if they do not exist
async function initDb() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    try {
      await fs.access(USERS_FILE);
    } catch {
      await fs.writeFile(USERS_FILE, JSON.stringify([]));
    }
    
    try {
      await fs.access(UPLOADS_FILE);
    } catch {
      await fs.writeFile(UPLOADS_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Read database file
async function readData(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading data from ${filePath}:`, err);
    return [];
  }
}

// Write database file
async function writeData(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing data to ${filePath}:`, err);
  }
}

// DB Methods
const db = {
  // Initialize
  init: initDb,

  // Users Collection
  users: {
    async findOne(query) {
      const users = await readData(USERS_FILE);
      return users.find(u => {
        for (let key in query) {
          if (u[key] !== query[key]) return false;
        }
        return true;
      });
    },

    async create(user) {
      const users = await readData(USERS_FILE);
      const newUser = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        createdAt: new Date().toISOString(),
        ...user
      };
      users.push(newUser);
      await writeData(USERS_FILE, users);
      return newUser;
    }
  },

  // Uploads Collection
  uploads: {
    async findMany(query = {}) {
      const uploads = await readData(UPLOADS_FILE);
      return uploads.filter(u => {
        for (let key in query) {
          if (u[key] !== query[key]) return false;
        }
        return true;
      }).reverse(); // Latest uploads first
    },

    async create(upload) {
      const uploads = await readData(UPLOADS_FILE);
      const newUpload = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        createdAt: new Date().toISOString(),
        ...upload
      };
      uploads.push(newUpload);
      await writeData(UPLOADS_FILE, uploads);
      return newUpload;
    },

    async delete(id) {
      const uploads = await readData(UPLOADS_FILE);
      const index = uploads.findIndex(u => u.id === id);
      if (index === -1) return null;
      const [deleted] = uploads.splice(index, 1);
      await writeData(UPLOADS_FILE, uploads);
      return deleted;
    },

    async findById(id) {
      const uploads = await readData(UPLOADS_FILE);
      return uploads.find(u => u.id === id);
    }
  }
};

module.exports = db;
