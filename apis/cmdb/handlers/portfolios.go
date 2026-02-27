package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

var ListPortfolios = listHandler("portfolios", "name", func(c *gin.Context, qb *queryBuilder) {
	if q := c.Query("q"); q != "" {
		qb.addLike("name", q)
	}
	if name := c.Query("name"); name != "" {
		qb.addFilter("name = ?", name)
	}
})

var GetPortfolio = getByPK("portfolios", "portfolio_id")
var DeletePortfolio = deleteByPK("portfolios", "portfolio_id")

func CreatePortfolio(c *gin.Context) {
	var input struct {
		Name        string  `json:"name" binding:"required"`
		SnowSysId   *string `json:"snow_sys_id"`
		State       *string `json:"state"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := newUUID()
	_, err := getDB().ExecContext(c,
		"INSERT INTO portfolios (portfolio_id, name, snow_sys_id, state, description) VALUES (?, ?, ?, ?, ?)",
		id, input.Name, input.SnowSysId, input.State, input.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM portfolios WHERE portfolio_id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, row)
}

func UpdatePortfolio(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}

	var input struct {
		Name        *string `json:"name"`
		SnowSysId   *string `json:"snow_sys_id"`
		State       *string `json:"state"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := getDB().ExecContext(c,
		"UPDATE portfolios SET name=COALESCE(?,name), snow_sys_id=COALESCE(?,snow_sys_id), state=COALESCE(?,state), description=COALESCE(?,description), updated_at=datetime('now') WHERE portfolio_id=?",
		input.Name, input.SnowSysId, input.State, input.Description, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	row, err := scanRow(getDB(), c, "SELECT * FROM portfolios WHERE portfolio_id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, row)
}
