This folder contains scripts to initialize the private CA used for mutual TLS in each environment.

The script ./create_certs.sh creates new self signed CA certificate and a client certificate. These are valid for 1 year.  
The private keys and certificates for these are stored in AWS secrets manager.  
The existing truststore file is downloaded from S3 and the new CA certificate is appended to the end of the existing one before uploading to enable old certificates to still to be used.  
The public CA cert is uploaded to s3://TRUSTSTORE_BUCKET_NAME/truststore.pem and s3://TRUSTSTORE_BUCKET_NAME/sandbox-truststore.pem where it used by API gateway as a truststore to indicate what certificates should be trusted for mutual TLS.

Before running the script, you should set environment variable AWS_PROFILE to indicate what environment this is being run for.  
You should pass the environment name using the -e flag when calling the script.  
By default the script does not upload new secrets or truststore files. If you want to do this, you must pass flag `-d false`.

Existing certificates and keys are backed up locally before new ones are uploaded.

To get API gateway to use the new truststore, you must do a redeploy of the cloud formation stack using github action.
