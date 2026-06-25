<<<<<<< HEAD
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
=======
<<<<<<< HEAD
# WelfareBot Backend

This is the backend service for WelfareBot built with FastAPI. It handles chat interactions and provides an API for the frontend client.

## Setup Instructions

1. Navigate to the backend directory:
   ```bash
   cd welfarebot-backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (Command Prompt):**
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   - **macOS / Linux:**
     ```bash
     source venv/bin/activate
     ```

4. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Set up the environment variables:
   ```bash
   copy .env.example .env
   # Then edit .env to add your actual keys:
   # GROQ_API_KEY=YOUR_GROQ_KEY
   # MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING
   # (Optionally keep GEMINI_API_KEY if needed for future)
   ```
   ```bash
   echo "GEMINI_API_KEY=YOUR_KEY_HERE" > .env
   ```
   Replace `YOUR_KEY_HERE` with your actual key. This file is ignored by Git.

6. Run the development server:
   ```bash
   uvicorn main:app --reload
   ```

By default, the API will be available at http://127.0.0.1:8000.


### Prerequisites
- Python 3.8 or higher installed.

### Installation

1. Navigate to the backend directory:
   ```bash
   cd welfarebot-backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (Command Prompt):**
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   - **macOS / Linux:**
     ```bash
     source venv/bin/activate
     ```

4. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Set up the environment variables:
   ```bash
   copy .env.example .env
   # or 'cp .env.example .env' on macOS/Linux
   ```

## Running the Server

Run the development server using Uvicorn:

```bash
uvicorn main:app --reload
```

By default, the API will be available at [http://127.0.0.1:8000](http://127.0.0.1:8000).

## API Endpoints

### 1. Health Check
- **Endpoint:** `GET /`
- **Response:**
  ```json
  {
    "status": "running"
  }
  ```

### 2. Chat Endpoint
- **Endpoint:** `POST /chat`
- **Request Body:**
  ```json
  {
    "session_id": "optional-session-id",
    "message": "Hello"
  }
  ```
- **Response:**
  ```json
  {
    "reply": "Hello! I received: Hello"
  }
  ```

## API Documentation
Once the server is running, you can access the interactive API docs at:
- Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
=======
# WELFARE_BOT
ITS USED TO HELP TO FIND GOVERNMENT SCHEME WHICH CAN BE CLAIMED BY PEOPLE 
>>>>>>> 10504b8a0541bfcf995d6991e4359dfd4e71a2d2
>>>>>>> 36fabfce5f4ec6506e4e081f399beb55cd1ea960
