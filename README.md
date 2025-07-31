# D&D Bot Mini App

This is a simple Telegram Mini App to complement the D&D Bot by providing a web interface for managing the current party lineup. You can view every member's character list and keep it updated every 3 seconds.

## Features

- View active adventures and their participants.
- Get detailed information about party members and their characters.
- Responsive and real-time updates.

## Prerequisites

- Node.js and npm installed on your machine.
- MySQL database with the necessary tables filled in (refer to your existing D&D Bot setup for configuration).

## Setup

1. **Clone the repository** or copy this directory into your `Git` directory.

2. **Navigate to the mini-app directory:**
   ```bash
   cd F:/Git/DnD_Bot_MiniApp
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Configure Environment Variables:**
   - Copy `.env.template` to `.env` and fill in the actual credentials and configuration values:
     ```
     DB_HOST=your_database_host
     DB_PORT=your_database_port
     DB_USER=your_database_user
     DB_PASSWORD=your_database_password
     DB_NAME=your_database_name
     TELEGRAM_BOT_TOKEN=your_telegram_bot_token
     ```

5. **Run the Server:**
   ```bash
   npm run dev
   ```
   - Or for production mode:
   ```bash
   npm start
   ```

6. **Access the Mini App:**
   - Open your browser and go to `http://localhost:3000` to interact with the app.

7. **Integrate with Telegram:**
   - Make sure your bot includes this Mini App URL to open it in Telegram.

## Notes

- Ensure your MySQL database is running and accessible with the credentials provided in your `.env` file.
- The application automatically fetches data from the server every 3 seconds, providing real-time updates for the current party lineup.

