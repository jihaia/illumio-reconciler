// CLI tool for running Aperture database migrations.
//
// Usage:
//
//	go run ./cmd             # run pending migrations
//	go run ./cmd status      # show applied migrations
package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	migrations "github.com/jihaia/aperture/packages/migrations"
	_ "modernc.org/sqlite"
)

func main() {
	dbPath := os.Getenv("APERTURE_DB_PATH")
	if dbPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		dir := filepath.Join(home, ".aperture")
		os.MkdirAll(dir, 0755)
		dbPath = filepath.Join(dir, "aperture.db")
	}

	db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	cmd := "up"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	switch cmd {
	case "up", "migrate":
		fmt.Printf("Database: %s\n", dbPath)
		fmt.Println("Running migrations...")
		if err := migrations.Run(db); err != nil {
			fmt.Fprintf(os.Stderr, "Migration failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Done.")

	case "status":
		list, err := migrations.Status(db)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		if len(list) == 0 {
			fmt.Println("No migrations applied.")
			return
		}
		fmt.Printf("%-40s %s\n", "MIGRATION", "APPLIED AT")
		fmt.Printf("%-40s %s\n", "─────────", "──────────")
		for _, m := range list {
			fmt.Printf("%-40s %s\n", m.Name, m.AppliedAt)
		}

	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\nUsage: migrate [up|status]\n", cmd)
		os.Exit(1)
	}
}
