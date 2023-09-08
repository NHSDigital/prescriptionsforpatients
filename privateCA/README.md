This folder contains scripts to initialize the private CA used for mutual TLS in each environment.

The script ./create_certs.sh creates new self signed CA certificate and a client certificate.  
The private keys and certificates for these are stored in AWS secrets manager.  
The public CA cert is uploaded to s3://${TRUSTSTORE_BUCKET_NAME}/truststore.pem and s3://${TRUSTSTORE_BUCKET_NAME}/sandbox-truststore.pem where it used by API gateway as a truststore to indicate what certificates should be trusted for mutual TLS.

Before running the script, you should set environment variable AWS_PROFILE to indicate what environment this is being run for.  
You should pass the environment name using the -e flag when calling the script.  
By default the script does not upload new secrets or truststore files. If you want to do this, you must pass flag `-d `
