package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

var (
	instance *sql.DB
	once     sync.Once
	initErr  error
	dbPath   string
)

// Setup opens the SQLite database (singleton).
// Uses APERTURE_DB_PATH env var, or defaults to ~/.aperture/aperture.db.
func Setup() (*sql.DB, error) {
	once.Do(func() {
		dbPath = os.Getenv("APERTURE_DB_PATH")
		if dbPath == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				initErr = fmt.Errorf("cannot determine home directory: %w", err)
				return
			}
			dbPath = filepath.Join(home, ".aperture", "aperture.db")
		}

		// Ensure the directory exists
		if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
			initErr = fmt.Errorf("create db directory: %w", err)
			return
		}

		instance, initErr = sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)")
		if initErr != nil {
			return
		}

		// Verify the connection
		initErr = instance.Ping()
	})
	return instance, initErr
}

// DB returns the singleton database connection.
// Panics if Setup() has not been called.
func DB() *sql.DB {
	if instance == nil {
		panic("db: not initialized — call Setup() first")
	}
	return instance
}

// Path returns the resolved path to the SQLite file.
func Path() string {
	return dbPath
}
