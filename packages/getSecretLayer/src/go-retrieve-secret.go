//
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// This code is used to retrieve values from AWS Secrets Manager and to output the
// decrypted values for conversion into Lambda Environmental Variables.
//
package main

import (
	"context"
	"flag"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"

	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/config"
)

// Constants for default values if none are supplied
const DEFAULT_TIMEOUT = 5000
const DEFAULT_REGION = "eu-west-2"
const DEFAULT_SESSION = "param_session"

var (
	region      string
	secretArn   string
	timeout     int
	sessionName string
)

// The main function will pull command line arg and retrieve the secret.  The resulting
// secret will be dumped to the output
func main() {

	// Get all of the command line data and perform the necessary validation
	getCommandParams()

	// Setup a new context to allow for limited execution time for API calls with a default of 200 milliseconds
	ctx, cancel := context.WithTimeout(context.TODO(), time.Duration(timeout)*time.Millisecond)
	defer cancel()

	// Load the config
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region), config.WithRetryer(func() aws.Retryer {
		// NopRetryer is used here in a global context to avoid retries on API calls
		return retry.AddWithMaxAttempts(aws.NopRetryer{}, 1)
	}))

	if err != nil {
		panic("configuration error " + err.Error())
	}

	// Get the secret
	result, err := GetSecret(ctx, cfg)

	if err != nil {
		panic("Failed to retrieve secret due to error " + err.Error())
	}

	// output the secret value
	fmt.Printf(*result.SecretString)
}

func getCommandParams() {
	// Setup command line args
	flag.StringVar(&region, "r", DEFAULT_REGION, "The Amazon Region to use")
	flag.StringVar(&secretArn, "s", "", "The ARN for the secret to access")
	flag.IntVar(&timeout, "t", DEFAULT_TIMEOUT, "The amount of time to wait for any API call")
	flag.StringVar(&sessionName, "n", DEFAULT_SESSION, "The name of the session for AWS STS")

	// Parse all of the command line args into the specified vars with the defaults
	flag.Parse()

	// Verify that the correct number of args were supplied
	if len(region) == 0 || len(secretArn) == 0 {
		flag.PrintDefaults()
		panic("You must supply a region and secret ARN.  -r REGION -s SECRET-ARN [-a ARN for ROLE -t TIMEOUT IN MILLISECONDS -n SESSION NAME]")
	}
}


// This function will return the descrypted version of the Secret from Secret Manager 
// This function will return either an error or the retrieved and decrypted secret.
func GetSecret(ctx context.Context, cfg aws.Config) (*secretsmanager.GetSecretValueOutput, error) {
	client := secretsmanager.NewFromConfig(cfg)
	return client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
		SecretId: aws.String(secretArn),
	})
}
