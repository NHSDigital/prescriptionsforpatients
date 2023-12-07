import {Logger} from "@aws-lambda-powertools/logger"
import {ServiceSearchClient, createServiceSearchClient} from "@prescriptionsforpatients/serviceSearchClient"
import {
  Bundle,
  BundleEntry,
  FhirResource,
  MedicationRequest,
  Organization
} from "fhir/r4"

export class ServiceSearch {
  private readonly logger: Logger
  private readonly client: ServiceSearchClient
  private localServicesCache: Record<string, string>

  constructor() {
    this.logger = new Logger()
    this.client = createServiceSearchClient(this.logger)
    this.localServicesCache = {}
  }

  search(searchsetBundle: Bundle) {
    const prescriptions: Array<Bundle> = this.isolatePrescriptions(searchsetBundle)
    const performerReferences: Set<string> = this.getPerformerReferences(prescriptions)
    const odsCodes: Set<string> = this.getOdsCodes(performerReferences, prescriptions)
    return
  }

  isolatePrescriptions(searchsetBundle: Bundle): Array<Bundle> {
    const entry: Array<BundleEntry<FhirResource>> = searchsetBundle.entry!
    const prescriptions = entry.filter((entry: BundleEntry<FhirResource>) =>
      entry.resource!.resourceType === "Bundle"
    )
    return prescriptions.map((p) => p.resource) as Array<Bundle>
  }

  getPerformerReferences(prescriptions: Array<Bundle>): Set<string> {
    const performerReferences: Set<string> = new Set<string>()
    const medicationRequests = prescriptions.flatMap((prescription: Bundle) =>
      prescription.entry!.filter((entry: BundleEntry<FhirResource>) =>
        entry.resource!.resourceType === "MedicationRequest"
      ).map((entry) => entry.resource)
    ) as Array<MedicationRequest>

    medicationRequests.forEach((medicationRequest) => {
      const reference = medicationRequest.dispenseRequest?.performer?.reference
      if (reference) {
        performerReferences.add(reference)
      }
    })
    return performerReferences
  }

  getOdsCodes(performerReferences: Set<string>, prescriptions: Array<Bundle>): Set<string> {
    const odsCodes: Set<string> = new Set<string>()
    prescriptions.forEach((prescription) =>
      prescription.entry!.filter((entry: BundleEntry<FhirResource>) =>
        performerReferences.has(entry.fullUrl!)
      ).forEach((entry: BundleEntry<FhirResource>) => {
        const organisation = entry.resource as Organization
        const odsCode = organisation.identifier![0].value!
        odsCodes.add(odsCode)
      })
    )
    return odsCodes
  }
}
