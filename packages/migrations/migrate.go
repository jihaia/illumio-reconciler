// Package migrations provides a shared migration runner for the Aperture SQLite database.
// It can be used as a library (by the Go API) or as a standalone CLI.
package migrations

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"
)

//go:embed sql/*.sql
var sqlFiles embed.FS

// Run applies all pending migrations to the given database connection.
// It creates the migrations tracking table if it doesn't exist,
// then applies any .sql files from sql/ that haven't been run yet.
func Run(db *sql.DB) error {
	// Create tracking table
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS migrations (
			name TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`)
	if err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}

	// Get already-applied migrations
	rows, err := db.Query("SELECT name FROM migrations")
	if err != nil {
		return fmt.Errorf("query migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		applied[name] = true
	}

	// Read all .sql files from embedded filesystem
	entries, err := fs.ReadDir(sqlFiles, "sql")
	if err != nil {
		return fmt.Errorf("read migration files: %w", err)
	}

	var pending []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			if !applied[e.Name()] {
				pending = append(pending, e.Name())
			}
		}
	}
	sort.Strings(pending)

	if len(pending) == 0 {
		return nil
	}

	// Apply each pending migration in a transaction
	for _, name := range pending {
		content, err := fs.ReadFile(sqlFiles, "sql/"+name)
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}

		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("begin tx for %s: %w", name, err)
		}

		if _, err := tx.Exec(string(content)); err != nil {
			tx.Rollback()
			return fmt.Errorf("migrate %s: %w", name, err)
		}

		if _, err := tx.Exec("INSERT INTO migrations (name) VALUES (?)", name); err != nil {
			tx.Rollback()
			return fmt.Errorf("record %s: %w", name, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit %s: %w", name, err)
		}

		fmt.Printf("  Applied: %s\n", name)
	}

	return nil
}

// Status returns the list of applied migrations.
func Status(db *sql.DB) ([]Migration, error) {
	rows, err := db.Query("SELECT name, applied_at FROM migrations ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Migration
	for rows.Next() {
		var m Migration
		if err := rows.Scan(&m.Name, &m.AppliedAt); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, nil
}

type Migration struct {
	Name      string
	AppliedAt string
}
