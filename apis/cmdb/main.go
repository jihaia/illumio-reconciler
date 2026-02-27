package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	ginadapter "github.com/awslabs/aws-lambda-go-api-proxy/gin"
	"github.com/gin-gonic/gin"

	"github.com/jihaia/aperture/apis/cmdb/db"
	"github.com/jihaia/aperture/apis/cmdb/routes"
)

var (
	router     *gin.Engine
	ginAdapter *ginadapter.GinLambdaV2
)

func init() {
	_, err := db.Setup()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	router = routes.NewRouter()
	ginAdapter = ginadapter.NewV2(router)
}

func handler(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	return ginAdapter.ProxyWithContext(ctx, req)
}

func main() {
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != "" {
		lambda.Start(handler)
		return
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Aperture CMDB API starting on :%s\n", port)
	fmt.Printf("Database: %s\n", db.Path())
	router.Run(":" + port)
}
