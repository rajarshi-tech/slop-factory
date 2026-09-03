from app.database import get_db


db = get_db()

db.execute("""
CREATE TABLE IF NOT EXISTS jobs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    status TEXT
)
""")

db.commit()
db.close()

print("Database initialized")