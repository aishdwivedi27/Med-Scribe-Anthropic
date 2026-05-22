/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// We define our locales
export type Locale = "US" | "India" | "Australia";

export interface ClinicalCoding {
  system: "http://hl7.org/fhir/sid/icd-10" | "http://snomed.info/sct" | "http://loinc.org" | "http://www.ama-assn.org/go/cpt" | "http://medicareaustralia.gov.au/mbs" | "http://www.nlm.nih.gov/research/umls/rxnorm" | "http://www.whocc.no/atc" | string;
  code: string;
  display: string;
  standard: "ICD-10" | "SNOMED-CT" | "LOINC" | "CPT" | "MBS" | "RxNorm" | "ATC" | "Other";
}

export interface ConfidenceValue<T> {
  value: T;
  confidence: "high" | "medium" | "low" | "none";
  originalText?: string; // Text fragment spoken that fits here
  codes?: ClinicalCoding[];
}

export interface PatientHeader {
  fullName: ConfidenceValue<string>;
  dob: ConfidenceValue<string>;
  age: ConfidenceValue<string>;
  gender: ConfidenceValue<string>;
  mrn: ConfidenceValue<string>;
  timeOfArrival: ConfidenceValue<string>;
  dateOfArrival: ConfidenceValue<string>;
  triageCategory: ConfidenceValue<string>; // "1" | "2" | "3" | "4" | "5"
  modeOfArrival: ConfidenceValue<string>; // "Ambulance" | "Walk-in" | "Other"
  modeOfArrivalOther: ConfidenceValue<string>;
}

export interface PersonalDetails {
  residentialAddress: ConfidenceValue<string>;
  primaryPhone: ConfidenceValue<string>;
  alternativePhone: ConfidenceValue<string>;
  emergencyContactName: ConfidenceValue<string>;
  relationship: ConfidenceValue<string>;
  emergencyContactPhone: ConfidenceValue<string>;
  nextOfKinPresent: ConfidenceValue<boolean | null>;
}

export interface PresentationAndSymptoms {
  chiefComplaint: ConfidenceValue<string>;
  historyOnset: ConfidenceValue<string>;
  historyDuration: ConfidenceValue<string>;
  historySeverity: ConfidenceValue<string>;
  historyAggravating: ConfidenceValue<string>;
  allergiesNkda: ConfidenceValue<boolean>;
  allergiesList: ConfidenceValue<string>;
  pastHistory: ConfidenceValue<string>;
  currentMedications: ConfidenceValue<string>;
}

export interface ClinicalVitals {
  timeOfVitals: ConfidenceValue<string>;
  bpSystolic: ConfidenceValue<string>;
  bpDiastolic: ConfidenceValue<string>;
  heartRate: ConfidenceValue<string>;
  hrRegularity: ConfidenceValue<string>; // "Regular" | "Irregular"
  respiratoryRate: ConfidenceValue<string>;
  temperature: ConfidenceValue<string>;
  temperatureRoute: ConfidenceValue<string>; // "Axillary" | "Tympanic" | "Oral" | "Rectal"
  spo2: ConfidenceValue<string>;
  spo2Mechanism: ConfidenceValue<string>; // "Room Air" | "Oxygen"
  spo2FlowRate: ConfidenceValue<string>;
  spo2Device: ConfidenceValue<string>;
  bloodGlucose: ConfidenceValue<string>;
  bloodGlucoseUnit: ConfidenceValue<string>; // "mmol/L" | "mg/dL"
  gcsEye: ConfidenceValue<string>;
  gcsVerbal: ConfidenceValue<string>;
  gcsMotor: ConfidenceValue<string>;
  gcsTotal: ConfidenceValue<string>;
  painScore: ConfidenceValue<string>;
  examFindingNotes: ConfidenceValue<string>;
  examFindingsChecked: {
    neuro: boolean;
    cardio: boolean;
    resp: boolean;
    abdo: boolean;
    musculoskeletal: boolean;
    skin: boolean;
  };
}

export interface InitialInvestigations {
  ecgTime: ConfidenceValue<string>;
  ecgResult: ConfidenceValue<string>;
  urinalysisResult: ConfidenceValue<string>;
  vbgAbgResult: ConfidenceValue<string>;
  labFbcOrdered: ConfidenceValue<boolean>;
  labUeOrdered: ConfidenceValue<boolean>;
  labLftOrdered: ConfidenceValue<boolean>;
  labCoagsOrdered: ConfidenceValue<boolean>;
  labTroponinOrdered: ConfidenceValue<boolean>;
  labOther: ConfidenceValue<string>;
  imgXrayOrdered: ConfidenceValue<boolean>;
  imgXrayRegion: ConfidenceValue<string>;
  imgCtOrdered: ConfidenceValue<boolean>;
  imgCtRegion: ConfidenceValue<string>;
  imgUltrasoundOrdered: ConfidenceValue<boolean>;
  imgUltrasoundDetail: ConfidenceValue<string>;
  imgMriOrdered: ConfidenceValue<boolean>;
  imgMriDetail: ConfidenceValue<string>;
}

export interface CourseOfAction {
  workingDiagnosis: ConfidenceValue<string>;
  immediateInterventions: ConfidenceValue<string>;
  medications: Array<{
    drug: string;
    dose: string;
    route: string;
    time: string;
    sign: string;
    codes?: ClinicalCoding[];
  }>;
  referralsSpecialty: ConfidenceValue<string>;
  referralsTime: ConfidenceValue<string>;
  referralsContactPerson: ConfidenceValue<string>;
  disposition: ConfidenceValue<string>; // "Discharge" | "Ward" | "Transfer" | "Surgery" | ""
  dispositionDetails: ConfidenceValue<string>;
  followUpTimeline: ConfidenceValue<string>;
}

export interface MedicalRecord {
  patientHeader: PatientHeader;
  personalDetails: PersonalDetails;
  presentation: PresentationAndSymptoms;
  vitals: ClinicalVitals;
  investigations: InitialInvestigations;
  courseOfAction: CourseOfAction;
}

export interface TranscriptResponse {
  record: MedicalRecord;
  processingReasoning: string;
}

export interface PresetCase {
  key: string;
  name: string;
  type: "clear" | "realistic" | "invalid" | "special" | "performance";
  tags: string[];
  transcript: string;
  explanation: string;
}
