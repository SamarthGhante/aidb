# AIDB

**AI-Powered Natural Language Database Interface | Transform Complex Queries into Simple Conversations**

> Chat with your databases using natural language. Upload SQL files and interact with your data through intelligent conversations powered by AI.

<video width="800" controls>
  <source src=".assets/video.webm" type="video/webm">
  Your browser does not support the video tag.
</video>

## Features

### AI-Powered Chat Interface
- Natural language database queries
- Intelligent SQL generation and execution
- Context-aware responses with data insights
- Powered by Groq API with Llama 3.3 70B model

### Universal SQL File Support
- **MySQL dumps** - Automatic syntax conversion to SQLite
- **SQLite files** - Native support
- **INSERT-only files** - Auto-generates table structure
- **phpMyAdmin exports** - Full compatibility

### Smart Database Processing
- Automatic schema extraction and analysis
- Real-time SQL query execution
- Table relationship detection
- Data type inference and conversion

## Local Deployment

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Groq API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aidb
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**
   ```bash
   populate the .env file
   ```
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)


## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4, Framer Motion
- **AI**: LangChain, Groq API (Llama 3.3 70B)
- **Database**: SQLite3


## License

This project is open source and available under the [MIT License](LICENSE).

---

**Dev: Samarth Ghante**