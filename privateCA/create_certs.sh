#!/usr/bin/env bash

while getopts e:d: flag
do
  case "$flag" in
    e) environment=${OPTARG};;
    d) dry_run_param=${OPTARG};;
    *) echo "usage: $0 [-e] environment [-d] dry run" >&2
       exit 1 ;;
  esac
done

if [ "$dry_run_param" = "false" ]; then
    DRY_RUN=false
else
    DRY_RUN=true
fi

if [ "$environment" = "" ]; then
    echo "You must pass in an environment name using the e flag"
    exit 1
fi

readonly BASE_DIR=$(pwd)
readonly CERTS_DIR="${BASE_DIR}/certs"
readonly KEYS_DIR="${BASE_DIR}/private"
readonly DATESTAMP=$(date +%Y%m%d_%H%M%S)
readonly BACKUP_CERTS_DIR="${BASE_DIR}/certs_backup_${DATESTAMP}"
readonly BACKUP_KEYS_DIR="${BASE_DIR}/private_backup_${DATESTAMP}"
readonly CRL_DIR="${BASE_DIR}/crl"
readonly CONFIG_DIR="${BASE_DIR}/config"

# OpenSSL Configs
readonly CA_CERT_SIGNING_CONFIG="openssl-ca.conf"
readonly CERT_VALIDITY_DAYS="365"

# CA config
readonly CA_NAME="ca"
readonly CA_CERTIFICATE_SUBJECT="/C=GB/ST=Leeds/L=Leeds/O=nhs/OU=prescriptions for patients private CA/CN=prescriptions for patients Private CA $(date +%Y%m%d_%H%M%S)"

readonly CERT_PREFIX="${environment}-"
readonly CERT_PREFIX_CI="ci"
readonly CERT_PREFIX_SANDBOX="sandbox"

readonly CLIENT_CERT_SUBJECT_PREFIX="/C=GB/ST=Leeds/L=Leeds/O=nhs/OU=prescriptions for patients private CA/CN=client-cert-"

# v3 extensions
readonly V3_EXT="$BASE_DIR/v3.ext"

function generate_crl {
    openssl ca -config openssl-ca.conf -gencrl -out "$CRL_DIR/$CA_NAME.crl"
}

function convert_cert_to_der {
    local readonly cert_name="$1"
    echo "@ Converting $cert_name to DER format..."
    openssl x509 -outform DER -in "$CERTS_DIR/$cert_name.pem" -out "$CERTS_DIR/$cert_name.crt"
}

function generate_key {
    local readonly key_name="$1"
    echo "@ Generating key '$key_name'..."
    openssl genrsa -out "$KEYS_DIR/$key_name.key" 2048
}

function generate_ca_cert {
    local readonly key_name="$1"
    echo "@ Generating CA certificate..."
    openssl req -new -x509 -days "$CERT_VALIDITY_DAYS" -config "$BASE_DIR/$CA_CERT_SIGNING_CONFIG" \
    -key "$KEYS_DIR/$key_name.key" \
    -out "$CERTS_DIR/$key_name.pem" -outform PEM -subj "$CA_CERTIFICATE_SUBJECT"

    convert_cert_to_der "$key_name"
}

function create_csr {
    local readonly key_name="$1"
    local readonly client_description="$2"

    if [ "$key_name" = "apigee_client_cert" ]
    then
        echo "@ Creating CSR for '$key_name'..."
        openssl req -config "$BASE_DIR/$SMARTCARD_CERT_SIGNING_CONFIG" -new \
        -key "$KEYS_DIR/$key_name.key" \
        -out "$CERTS_DIR/$key_name.csr" -outform PEM \
        -subj "${CLIENT_CERT_SUBJECT_PREFIX}${CERT_PREFIX}${CERT_PREFIX_CI}${client_description}"
    elif [ "$key_name" = "apigee_client_cert_sandbox" ]
    then
        echo "@ Creating CSR for '$key_name'..."
        openssl req -config "$BASE_DIR/$SMARTCARD_CERT_SIGNING_CONFIG" -new \
        -key "$KEYS_DIR/$key_name.key" \
        -out "$CERTS_DIR/$key_name.csr" -outform PEM \
        -subj "${CLIENT_CERT_SUBJECT_PREFIX}${CERT_PREFIX}${CERT_PREFIX_SANDBOX}${client_description}"
    fi
}

function sign_csr_with_ca {
    local readonly key_name="$1"
    echo "@ Using CSR to generate signed cert for '$key_name'..."
    openssl ca -batch \
    -config "$BASE_DIR/$CA_CERT_SIGNING_CONFIG" -policy signing_policy -extensions signing_req \
    -keyfile "$KEYS_DIR/$CA_NAME.key" -cert "$CERTS_DIR/$CA_NAME.pem" \
    -days "$CERT_VALIDITY_DAYS" -out "$CERTS_DIR/$key_name.pem" -in "$CERTS_DIR/$key_name.csr" \
    -notext # don't output the text form of a certificate to the output file
}


function generate_ca_signed_cert {
    local readonly key_name="$1"
    local readonly cert_subject="$2"

    create_csr "$key_name" "$cert_subject"
    sign_csr_with_ca "$key_name"
}


function generate_client_cert {
    local readonly name="$1"

    local readonly description="-apigee-client-cert"
    generate_key "$name"
    generate_ca_signed_cert "$name" "$description"
    convert_cert_to_der "$name"
}

echo "Going to create mutual TLS certs with these details"
echo "AWS_PROFILE: ${AWS_PROFILE}"
echo "CERT_PREFIX ${CERT_PREFIX}"
echo "DRY_RUN ${DRY_RUN}"
read -p "Press any key to resume or press ctrl+c to exit ..."

# Recreate output dirs
rm -rf "$CERTS_DIR" "$KEYS_DIR" "$CRL_DIR" "$CONFIG_DIR"
mkdir "$CERTS_DIR" "$KEYS_DIR" "$CRL_DIR" "$CONFIG_DIR" "$BACKUP_CERTS_DIR" "$BACKUP_KEYS_DIR"


# Create database and serial files
touch "$CONFIG_DIR/index.txt"
echo '1000' > "$CONFIG_DIR/crlnumber.txt"
echo '01' > "$CONFIG_DIR/serial.txt"

# Generate CA key and self-signed cert
echo "Generating CA credentials..."
generate_key "$CA_NAME"
generate_ca_cert "$CA_NAME"

generate_client_cert "apigee_client_cert"
generate_client_cert "apigee_client_cert_sandbox"

CA_KEY_ARN=$(aws cloudformation describe-stacks \
    --stack-name account-resources \
    --query 'Stacks[0].Outputs[?OutputKey==`CAKeySecret`].OutputValue' --output text)
CA_CERT_ARN=$(aws cloudformation describe-stacks \
    --stack-name account-resources \
    --query 'Stacks[0].Outputs[?OutputKey==`CACertSecret`].OutputValue' --output text)
CLIENT_KEY_ARN=$(aws cloudformation describe-stacks \
    --stack-name account-resources \
    --query 'Stacks[0].Outputs[?OutputKey==`ClientKeySecret`].OutputValue' --output text)
CLIENT_CERT_ARN=$(aws cloudformation describe-stacks \
    --stack-name account-resources \
    --query 'Stacks[0].Outputs[?OutputKey==`ClientCertSecret`].OutputValue' --output text)
CLIENT_SANDBOX_KEY_ARN=$(aws cloudformation describe-stacks \
    --stack-name account-resources \
    --query 'Stacks[0].Outputs[?OutputKey==`ClientSandboxKeySecret`].OutputValue' --output text)
CLIENT_SANDBOX_CERT_ARN=$(aws cloudformation describe-stacks \
    --stack-name account-resources \
    --query 'Stacks[0].Outputs[?OutputKey==`ClientSandboxCertSecret`].OutputValue' --output text)
TRUSTSTORE_BUCKET_ARN=$(aws cloudformation describe-stacks \
    --stack-name account-resources \
    --query 'Stacks[0].Outputs[?OutputKey==`TrustStoreBucket`].OutputValue' --output text)
TRUSTSTORE_BUCKET_NAME=$(echo ${TRUSTSTORE_BUCKET_ARN} | cut -d ":" -f 6)

echo "Backing up existing secrets to local file"

aws secretsmanager get-secret-value \
    --secret-id ${CA_KEY_ARN} \
    --query SecretString \
    --output text > ${BACKUP_KEYS_DIR}/${CA_NAME}.key

aws secretsmanager get-secret-value \
    --secret-id ${CA_CERT_ARN} \
    --query SecretString \
    --output text > ${BACKUP_CERTS_DIR}/${CA_NAME}.pem

aws secretsmanager get-secret-value \
    --secret-id ${CLIENT_KEY_ARN} \
    --query SecretString \
    --output text > ${BACKUP_KEYS_DIR}/apigee_client_cert.key

aws secretsmanager get-secret-value \
    --secret-id ${CLIENT_CERT_ARN} \
    --query SecretString \
    --output text > ${BACKUP_CERTS_DIR}/apigee_client_cert.pem

aws secretsmanager get-secret-value \
    --secret-id ${CLIENT_SANDBOX_KEY_ARN} \
    --query SecretString \
    --output text > ${BACKUP_KEYS_DIR}/apigee_client_cert_sandbox.key
aws secretsmanager get-secret-value \
    --secret-id ${CLIENT_SANDBOX_CERT_ARN} \
    --query SecretString \
    --output text > ${BACKUP_CERTS_DIR}/apigee_client_cert_sandbox.pem

echo "Creating new combined truststore files for upload"

aws s3api head-object --bucket ${TRUSTSTORE_BUCKET_NAME} --key truststore.pem || NOT_EXIST=true
if [ $NOT_EXIST ]; then
  echo "" > ${BACKUP_CERTS_DIR}/s3_truststore.pem
else
    aws s3 cp s3://${TRUSTSTORE_BUCKET_NAME}/truststore.pem ${BACKUP_CERTS_DIR}/s3_truststore.pem 
fi

aws s3api head-object --bucket ${TRUSTSTORE_BUCKET_NAME} --key sandbox-truststore.pem || NOT_EXIST=true
if [ $NOT_EXIST ]; then
  echo "" > ${BACKUP_CERTS_DIR}/s3_sandbox_truststore.pem
else
    aws s3 cp s3://${TRUSTSTORE_BUCKET_NAME}/sandbox-truststore.pem ${BACKUP_CERTS_DIR}/s3_sandbox_truststore.pem 
fi


cat ${BACKUP_CERTS_DIR}/s3_truststore.pem ${CERTS_DIR}/${CA_NAME}.pem > ${CERTS_DIR}/truststore.pem
cat ${BACKUP_CERTS_DIR}/s3_sandbox_truststore.pem ${CERTS_DIR}/${CA_NAME}.pem > ${CERTS_DIR}/sandbox_truststore.pem


if [ "$DRY_RUN" = "false" ]; then
    echo "Setting new keys in secrets manager"
    read -p "Press any key to resume or press ctrl+c to exit ..."
    aws secretsmanager put-secret-value \
        --secret-id ${CA_KEY_ARN} \
        --secret-string file://${KEYS_DIR}/${CA_NAME}.key
    aws secretsmanager put-secret-value \
        --secret-id ${CA_CERT_ARN} \
        --secret-string file://${CERTS_DIR}/${CA_NAME}.pem

    aws secretsmanager put-secret-value \
        --secret-id ${CLIENT_KEY_ARN} \
        --secret-string file://${KEYS_DIR}/apigee_client_cert.key
    aws secretsmanager put-secret-value \
        --secret-id ${CLIENT_CERT_ARN} \
        --secret-string file://${CERTS_DIR}/apigee_client_cert.pem

    aws secretsmanager put-secret-value \
        --secret-id ${CLIENT_SANDBOX_KEY_ARN} \
        --secret-string file://${KEYS_DIR}/apigee_client_cert_sandbox.key
    aws secretsmanager put-secret-value \
        --secret-id ${CLIENT_SANDBOX_CERT_ARN} \
        --secret-string file://${CERTS_DIR}/apigee_client_cert_sandbox.pem

    echo "Going to create new truststore files on S3"
    read -p "Press any key to resume or press ctrl+c to exit ..."

    aws s3 cp ${CERTS_DIR}/truststore.pem s3://${TRUSTSTORE_BUCKET_NAME}/truststore.pem
    aws s3 cp ${CERTS_DIR}/sandbox_truststore.pem s3://${TRUSTSTORE_BUCKET_NAME}/sandbox-truststore.pem

else
    echo "Not setting new secrets or upleading truststore files as dry run set to true"
fi
