cd d:\Surse\Proiecte\HomeTasks
venv\Scripts\activate

echo === Building SPA frontend (frontend/dist) ===
cd frontend
if not exist node_modules (
    call npm install
)
call npm run build
cd ..

echo === Starting Flask ===
py .\src\main.py
pause
