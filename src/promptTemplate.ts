/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const SYSTEM_PROMPT = `You are an expert AI clinical transcriptionist, emergency department medical records registrar, and medical coding specialist (ICD-10, SNOMED-CT, LOINC, CPT, MBS, RxNorm).
Your task is to parse a raw medical conversation (recorded or spoken, sometimes mixing multilingual terminology like Hindi/English) and populate a comprehensive clinical intake record alongside accurate standardized clinical codes.

You MUST satisfy the following rules:

1. COMPREHENSION & LOCALIZATION:
   - Understand clinical terminology from the US, India, and Australia.
   - Accurately process bilingual or mixed-language speech (e.g. "Patient ko chest mein pain ho raha hai", "bukhar hai" -> fever, etc.).
   - Support regional unit mappings (e.g., Blood Glucose can be in mmol/L or mg/dL; Temperature in Celsius or Fahrenheit; MRN or UHID for hospitals).

2. STRICTOR CONFIDENCE SCORING:
   Assign to every single field a 'confidence' score ('high', 'medium', 'low', 'none') and map them to standard colors in the UI:
   - 'high' (displayed in BLUE): Clearly, explicitly stated in the conversation (e.g., "Systolic 120 diastolic 80") with no ambiguity.
   - 'medium' (displayed in PURPLE): Inferred, partially stated, translated from local slang, or spoken with minor uncertainty (e.g., "sugar was like hundred and ten or something", "BP normal hai").
   - 'low' (displayed in RED): Highly ambiguous, speculative, conflicting, or reported as uncertain by third-parties with substantial clinical doubt.
   - 'none': Not spoken or explicitly missing. Keep the value empty ("" or false/null) and set confidence to 'none'.

3. SPECIFIC FIELD INSTRUCTIONS:
   - ALLERGIES: Look for "penicillin", "Sulfa", etc. If specifically mentioned "no allergies" or "NKDA", set allergiesNkda = true, and confidence = 'high'.
   - GCS: GCS has E (Eye response 1-4), V (Verbal response 1-5), M (Motor response 1-6) and Total (sum 3-15). Extract whatever is spoken.
   - VITALS: Under SPO2, keep track of room air vs supplemental oxygen. Under BP, split into systolic and diastolic.

4. MANDATORY HEALTHCARE STANDARDIZATION & CODING CODES:
   For every field representing clinical conditions, symptoms, history, vitals, procedures, or medications, you MUST research appropriate codes and place them in the 'codes' array for that field. Include standard systems:
   - Chief Complaint, Past History, workingDiagnosis: Provide standard 'ICD-10' (maps both R-codes or specific diagnosis codes) and 'SNOMED-CT' codes.
   - Clincal Vitals: Must populate correct 'LOINC' codes. Use these exact codes:
     - bpSystolic: "8480-6" (display: Systolic blood pressure)
     - bpDiastolic: "8462-4" (display: Diastolic blood pressure)
     - heartRate: "8867-4" (display: Heart rate)
     - respiratoryRate: "9279-1" (display: Respiratory rate)
     - temperature: "8310-5" (display: Body temperature)
     - spo2: "2708-6" (display: Oxygen saturation in Arterial blood by Pulse oximetry)
     - bloodGlucose: "15074-8" (display: Glucose [Mass/volume] in Blood)
   - Initial Investigations (ECG, urinalysis, labs ordered, imaging ordered): Map to corresponding 'LOINC' codes and 'CPT' (US, e.g. 80053, 93000) or 'MBS' (Australian Medicare Benefits Schedule) codes where relevant.
   - Procedures/Interventions: Provide 'CPT', 'MBS', or 'SNOMED-CT' codes representing the care.
   - Medication list: Model the drug substances utilizing standard 'RxNorm' codes and/or Anatomical Therapeutic Chemical 'ATC' systems.

5. OUTPUT FORMAT:
   You MUST return ONLY valid JSON matching the schema provided. Do not include any HTML tags, conversational chit-chat, or markdown formatting blocks (like \`\`\`json). Output raw, parseable JSON only.

Make sure you adhere strictly to what was heard. If something is completely absent, keep the value empty ("" or false/null) and confidence as "none".`;

const clinicalValueSchema = (valueType: "STRING" | "BOOLEAN") => ({
  type: "OBJECT",
  properties: {
    value: { type: valueType },
    confidence: { type: "STRING" },
    originalText: { type: "STRING" },
    codes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          system: { type: "STRING" },
          code: { type: "STRING" },
          display: { type: "STRING" },
          standard: { type: "STRING" }
        },
        required: ["system", "code", "display", "standard"]
      }
    }
  },
  required: ["value", "confidence"]
});

const stringVal = clinicalValueSchema("STRING");
const boolVal = clinicalValueSchema("BOOLEAN");

export const JSON_SCHEMA = {
  type: "OBJECT",
  description: "Perfectly formatted Emergency Department Clinical Assessment Intake Record with Codes",
  properties: {
    record: {
      type: "OBJECT",
      properties: {
        patientHeader: {
          type: "OBJECT",
          properties: {
            fullName: stringVal,
            dob: stringVal,
            age: stringVal,
            gender: stringVal,
            mrn: stringVal,
            timeOfArrival: stringVal,
            dateOfArrival: stringVal,
            triageCategory: stringVal,
            modeOfArrival: stringVal,
            modeOfArrivalOther: stringVal
          },
          required: ["fullName", "dob", "age", "gender", "mrn", "timeOfArrival", "dateOfArrival", "triageCategory", "modeOfArrival", "modeOfArrivalOther"]
        },
        personalDetails: {
          type: "OBJECT",
          properties: {
            residentialAddress: stringVal,
            primaryPhone: stringVal,
            alternativePhone: stringVal,
            emergencyContactName: stringVal,
            relationship: stringVal,
            emergencyContactPhone: stringVal,
            nextOfKinPresent: boolVal
          },
          required: ["residentialAddress", "primaryPhone", "alternativePhone", "emergencyContactName", "relationship", "emergencyContactPhone", "nextOfKinPresent"]
        },
        presentation: {
          type: "OBJECT",
          properties: {
            chiefComplaint: stringVal,
            historyOnset: stringVal,
            historyDuration: stringVal,
            historySeverity: stringVal,
            historyAggravating: stringVal,
            allergiesNkda: boolVal,
            allergiesList: stringVal,
            pastHistory: stringVal,
            currentMedications: stringVal
          },
          required: ["chiefComplaint", "historyOnset", "historyDuration", "historySeverity", "historyAggravating", "allergiesNkda", "allergiesList", "pastHistory", "currentMedications"]
        },
        vitals: {
          type: "OBJECT",
          properties: {
            timeOfVitals: stringVal,
            bpSystolic: stringVal,
            bpDiastolic: stringVal,
            heartRate: stringVal,
            hrRegularity: stringVal,
            respiratoryRate: stringVal,
            temperature: stringVal,
            temperatureRoute: stringVal,
            spo2: stringVal,
            spo2Mechanism: stringVal,
            spo2FlowRate: stringVal,
            spo2Device: stringVal,
            bloodGlucose: stringVal,
            bloodGlucoseUnit: stringVal,
            gcsEye: stringVal,
            gcsVerbal: stringVal,
            gcsMotor: stringVal,
            gcsTotal: stringVal,
            painScore: stringVal,
            examFindingNotes: stringVal,
            examFindingsChecked: {
              type: "OBJECT",
              properties: {
                neuro: { type: "BOOLEAN" },
                cardio: { type: "BOOLEAN" },
                resp: { type: "BOOLEAN" },
                abdo: { type: "BOOLEAN" },
                musculoskeletal: { type: "BOOLEAN" },
                skin: { type: "BOOLEAN" }
              },
              required: ["neuro", "cardio", "resp", "abdo", "musculoskeletal", "skin"]
            }
          },
          required: [
            "timeOfVitals", "bpSystolic", "bpDiastolic", "heartRate", "hrRegularity",
            "respiratoryRate", "temperature", "temperatureRoute", "spo2", "spo2Mechanism",
            "spo2FlowRate", "spo2Device", "bloodGlucose", "bloodGlucoseUnit",
            "gcsEye", "gcsVerbal", "gcsMotor", "gcsTotal", "painScore", "examFindingNotes", "examFindingsChecked"
          ]
        },
        investigations: {
          type: "OBJECT",
          properties: {
            ecgTime: stringVal,
            ecgResult: stringVal,
            urinalysisResult: stringVal,
            vbgAbgResult: stringVal,
            labFbcOrdered: boolVal,
            labUeOrdered: boolVal,
            labLftOrdered: boolVal,
            labCoagsOrdered: boolVal,
            labTroponinOrdered: boolVal,
            labOther: stringVal,
            imgXrayOrdered: boolVal,
            imgXrayRegion: stringVal,
            imgCtOrdered: boolVal,
            imgCtRegion: stringVal,
            imgUltrasoundOrdered: boolVal,
            imgUltrasoundDetail: stringVal,
            imgMriOrdered: boolVal,
            imgMriDetail: stringVal
          },
          required: [
            "ecgTime", "ecgResult", "urinalysisResult", "vbgAbgResult",
            "labFbcOrdered", "labUeOrdered", "labLftOrdered", "labCoagsOrdered", "labTroponinOrdered", "labOther",
            "imgXrayOrdered", "imgXrayRegion", "imgCtOrdered", "imgCtRegion", "imgUltrasoundOrdered", "imgUltrasoundDetail",
            "imgMriOrdered", "imgMriDetail"
          ]
        },
        courseOfAction: {
          type: "OBJECT",
          properties: {
            workingDiagnosis: stringVal,
            immediateInterventions: stringVal,
            medications: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  drug: { type: "STRING" },
                  dose: { type: "STRING" },
                  route: { type: "STRING" },
                  time: { type: "STRING" },
                  sign: { type: "STRING" },
                  codes: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        system: { type: "STRING" },
                        code: { type: "STRING" },
                        display: { type: "STRING" },
                        standard: { type: "STRING" }
                      },
                      required: ["system", "code", "display", "standard"]
                    }
                  }
                },
                required: ["drug", "dose", "route", "time", "sign"]
              }
            },
            referralsSpecialty: stringVal,
            referralsTime: stringVal,
            referralsContactPerson: stringVal,
            disposition: stringVal,
            dispositionDetails: stringVal,
            followUpTimeline: stringVal
          },
          required: ["workingDiagnosis", "immediateInterventions", "medications", "referralsSpecialty", "referralsTime", "referralsContactPerson", "disposition", "dispositionDetails", "followUpTimeline"]
        }
      },
      required: ["patientHeader", "personalDetails", "presentation", "vitals", "investigations", "courseOfAction"]
    },
    processingReasoning: {
      type: "STRING",
      description: "Brief conceptual explanation explaining the linguistic mappings, translation assumptions, and clinical confidence criteria applied during extraction."
    }
  },
  required: ["record", "processingReasoning"]
};
