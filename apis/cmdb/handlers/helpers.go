package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jihaia/aperture/apis/cmdb/db"
)

// pagination extracts limit/offset from query params with sensible defaults.
func pagination(c *gin.Context) (limit, offset int) {
	limit = 100
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 1000 {
			limit = v
		}
	}
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}
	return
}

// queryBuilder helps build dynamic SQL queries.
type queryBuilder struct {
	where []string
	args  []any
}

func (qb *queryBuilder) addFilter(clause string, val any) {
	qb.where = append(qb.where, clause)
	qb.args = append(qb.args, val)
}

func (qb *queryBuilder) addLike(column, val string) {
	qb.where = append(qb.where, column+" LIKE ?")
	qb.args = append(qb.args, "%"+val+"%")
}

func (qb *queryBuilder) whereClause() string {
	if len(qb.where) == 0 {
		return ""
	}
	return " WHERE " + strings.Join(qb.where, " AND ")
}

// idParam extracts and validates an integer :id path parameter.
func idParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return 0, false
	}
	return id, true
}

// scanRows scans all rows into a slice of maps.
func scanRows(rows *sql.Rows) ([]map[string]any, error) {
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var results []map[string]any
	for rows.Next() {
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		row := make(map[string]any, len(cols))
		for i, col := range cols {
			row[col] = vals[i]
		}
		results = append(results, row)
	}
	return results, nil
}

// scanRow scans a single row into a map.
func scanRow(db *sql.DB, c *gin.Context, query string, args ...any) (map[string]any, error) {
	rows, err := db.QueryContext(c, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results, err := scanRows(rows)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, sql.ErrNoRows
	}
	return results[0], nil
}

// listHandler is a generic list handler factory.
func listHandler(table, orderBy string, filters func(c *gin.Context, qb *queryBuilder)) gin.HandlerFunc {
	return func(c *gin.Context) {
		qb := &queryBuilder{}
		if filters != nil {
			filters(c, qb)
		}

		limit, offset := pagination(c)

		query := fmt.Sprintf("SELECT * FROM %s%s ORDER BY %s LIMIT ? OFFSET ?", table, qb.whereClause(), orderBy)
		qb.args = append(qb.args, limit, offset)

		rows, err := getDB().QueryContext(c, query, qb.args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		results, err := scanRows(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if results == nil {
			results = []map[string]any{}
		}

		c.JSON(http.StatusOK, gin.H{
			"data":  results,
			"count": len(results),
		})
	}
}

// getHandler is a generic get-by-id handler factory.
func getHandler(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := idParam(c)
		if !ok {
			return
		}

		query := fmt.Sprintf("SELECT * FROM %s WHERE id = ?", table)
		row, err := scanRow(getDB(), c, query, id)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

// deleteHandler is a generic delete-by-id handler factory.
func deleteHandler(table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := idParam(c)
		if !ok {
			return
		}

		query := fmt.Sprintf("DELETE FROM %s WHERE id = ?", table)
		result, err := getDB().ExecContext(c, query, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"deleted": true})
	}
}

func getDB() *sql.DB {
	return db.DB()
}
