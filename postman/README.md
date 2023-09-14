# Setting up Postman

Some instructions on getting the Postman collection working to call the [prescriptionsforpatients](https://github.com/NHSDigital/prescriptionsforpatients) API.

## Import the collection

In Postman click the Menu, then File, Import, and select the file: `prescriptionsforpatients\postman\prescriptions_for_patients.postman_collection.json` from the Repo.

**NB: It is possible to import directly from GitHub too.**

## Setting up Environments

It makes sense to have a separate environment for Sandbox and Internal Dev, so you need to create two Environments.

### For Sandbox

In Postman select Environments on the Sidebar and create a new Environment. Rename the Environment to something obvious and add the following variables:

| Name          |                         Value                          |
| :------------ | :----------------------------------------------------: |
| host          |        internal-dev-sandbox.api.service.nhs.uk         |
| client_id     | [ Get this from your App settings in Apigee Non Prod ] |
| client_secret | [ Get this from your App settings in Apigee Non Prod ] |

### For Internal Dev

In Postman select Environments on the Sidebar and create a new Environment. Rename the Environment to something obvious and add the following variables:

| Name          |                         Value                          |
| :------------ | :----------------------------------------------------: |
| host          |            internal-dev.api.service.nhs.uk             |
| client_id     | [ Get this from your App settings in Apigee Non Prod ] |
| client_secret | [ Get this from your App settings in Apigee Non Prod ] |

## Request a Token

In Postman select Collections, expand the prescriptions for patients collection, select the **Bundle** request.

Ensure you have selected the appropriate Environment created above.

Select the Authorization tab, scroll right to the bottom and click **Get New Access Token**

You will be prompted by NHS LOGIN MOCK INTERNAL DEV for a `Username or email`, enter one of the NHS Numbers taken from the list provided [here](https://nhsd-confluence.digital.nhs.uk/display/APM/Testing+with+mock+auth#Testingwithmockauth-NHSLogintestusers).

Make sure to click the Use Token button.

## Submit a request

You can now Send your request to **Bundle** and should get back the appropriate response.
