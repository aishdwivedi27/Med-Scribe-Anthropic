import { MedicalRecord, ClinicalCoding } from "../types";

/**
 * Generates a fully-compliant FHIR R4 Bundle of type "collection" 
 * representing all clinical observations, patient headers, conditions, 
 * diagnostic orders, and course of actions extracted from the medical encounter.
 */
export function generateFhirBundle(record: MedicalRecord): any {
  const patientId = "patient-1";
  const encounterId = "encounter-1";
  const organizationId = "org-1";

  const entry: any[] = [];

  // 1. Patient Resource
  const patientHeader = record.patientHeader;
  const personalDetails = record.personalDetails;
  
  const fhirPatient: any = {
    resourceType: "Patient",
    id: patientId,
    active: true,
    name: [
      {
        use: "official",
        text: patientHeader.fullName.value || "Anonymous Patient",
        family: patientHeader.fullName.value ? patientHeader.fullName.value.split(" ").pop() : "",
        given: patientHeader.fullName.value ? patientHeader.fullName.value.split(" ").slice(0, -1) : []
      }
    ]
  };

  if (patientHeader.dob.value) {
    // Attempt standard formatting if possible (YYYY-MM-DD)
    fhirPatient.birthDate = patientHeader.dob.value;
  }

  if (patientHeader.gender.value) {
    const origGender = patientHeader.gender.value.toLowerCase();
    if (origGender.startsWith("m")) {
      fhirPatient.gender = "male";
    } else if (origGender.startsWith("f")) {
      fhirPatient.gender = "female";
    } else if (origGender.startsWith("o")) {
      fhirPatient.gender = "other";
    } else {
      fhirPatient.gender = "unknown";
    }
    // Add gender coding if available
    if (patientHeader.gender.codes && patientHeader.gender.codes.length > 0) {
      fhirPatient.extension = [
        {
          url: "http://hl7.org/fhir/StructureDefinition/patient-genderIdentity",
          valueCodeableConcept: {
            coding: patientHeader.gender.codes.map((c) => ({
              system: c.system,
              code: c.code,
              display: c.display
            }))
          }
        }
      ];
    }
  }

  // Address and Phone
  const addressList: any[] = [];
  if (personalDetails.residentialAddress.value) {
    addressList.push({
      use: "home",
      type: "physical",
      text: personalDetails.residentialAddress.value
    });
  }
  if (addressList.length > 0) {
    fhirPatient.address = addressList;
  }

  const telecomList: any[] = [];
  if (personalDetails.primaryPhone.value) {
    telecomList.push({
      system: "phone",
      value: personalDetails.primaryPhone.value,
      use: "mobile"
    });
  }
  if (personalDetails.alternativePhone.value) {
    telecomList.push({
      system: "phone",
      value: personalDetails.alternativePhone.value,
      use: "home"
    });
  }
  if (telecomList.length > 0) {
    fhirPatient.telecom = telecomList;
  }

  // Emergency Contact Name
  if (personalDetails.emergencyContactName.value) {
    fhirPatient.contact = [
      {
        relationship: [
          {
            text: personalDetails.relationship.value || "Emergency Contact"
          }
        ],
        name: {
          text: personalDetails.emergencyContactName.value
        },
        telecom: personalDetails.emergencyContactPhone.value ? [
          {
            system: "phone",
            value: personalDetails.emergencyContactPhone.value
          }
        ] : []
      }
    ];
  }

  // MRN (Medical Record Number / Unique Health ID)
  if (patientHeader.mrn.value) {
    fhirPatient.identifier = [
      {
        use: "usual",
        type: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0203",
              code: "MR",
              display: "Medical Record Number"
            }
          ]
        },
        system: "http://hospital.org/fhir/mrn",
        value: patientHeader.mrn.value
      }
    ];
  }

  entry.push({
    fullUrl: `urn:uuid:Patient/${patientId}`,
    resource: fhirPatient
  });

  // 2. Encounter Resource
  const fhirEncounter: any = {
    resourceType: "Encounter",
    id: encounterId,
    status: "in-progress",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "EMER",
      display: "emergency"
    },
    subject: {
      reference: `urn:uuid:Patient/${patientId}`,
      display: patientHeader.fullName.value || "Patient"
    }
  };

  const period: any = {};
  if (patientHeader.dateOfArrival.value) {
    const timeVal = patientHeader.timeOfArrival.value || "00:00";
    period.start = `${patientHeader.dateOfArrival.value}T${timeVal}:00Z`;
  }
  if (period.start) {
    fhirEncounter.period = period;
  }

  // Triage Category mapping to Emergency Priority (SNOMED-CT / standard triage mapping)
  if (patientHeader.triageCategory.value) {
    fhirEncounter.priority = {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActPriority",
          code: patientHeader.triageCategory.value,
          display: `Triage Category ${patientHeader.triageCategory.value}`
        }
      ],
      text: `Emergency Triage Category: ${patientHeader.triageCategory.value}`
    };
  }

  entry.push({
    fullUrl: `urn:uuid:Encounter/${encounterId}`,
    resource: fhirEncounter
  });

  // 3. Chief Complaint (Observation / Condition)
  const presentation = record.presentation;
  if (presentation.chiefComplaint.value) {
    const chiefComplaintCodes: ClinicalCoding[] = presentation.chiefComplaint.codes || [
      {
        system: "http://snomed.info/sct",
        code: "29857009",
        display: "Chest pain (finding)",
        standard: "SNOMED-CT"
      }
    ];

    const fhirCC: any = {
      resourceType: "Condition",
      id: "cond-chief-complaint",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active"
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: "confirmed"
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "problem-list-item",
              display: "Problem List Item"
            }
          ]
        }
      ],
      code: {
        coding: chiefComplaintCodes.map((c) => ({
          system: c.system,
          code: c.code,
          display: c.display
        })),
        text: presentation.chiefComplaint.value
      },
      subject: {
        reference: `urn:uuid:Patient/${patientId}`
      },
      encounter: {
        reference: `urn:uuid:Encounter/${encounterId}`
      }
    };
    if (presentation.chiefComplaint.originalText) {
      fhirCC.note = [{ text: `Vocalized complaint: "${presentation.chiefComplaint.originalText}"` }];
    }
    entry.push({
      fullUrl: "urn:uuid:Condition/cond-chief-complaint",
      resource: fhirCC
    });
  }

  // 4. Past Medical History (Condition)
  if (presentation.pastHistory.value) {
    const pastHistCodes: ClinicalCoding[] = presentation.pastHistory.codes || [];
    const fhirPH: any = {
      resourceType: "Condition",
      id: "cond-past-history",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active"
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: "confirmed"
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
              display: "Encounter Diagnosis"
            }
          ]
        }
      ],
      code: {
        coding: pastHistCodes.map((c) => ({
          system: c.system,
          code: c.code,
          display: c.display
        })),
        text: presentation.pastHistory.value
      },
      subject: {
        reference: `urn:uuid:Patient/${patientId}`
      }
    };
    entry.push({
      fullUrl: "urn:uuid:Condition/cond-past-history",
      resource: fhirPH
    });
  }

  // 5. Vitals (Mapped with LOINC Codes)
  const vitals = record.vitals;

  const createVitalObservation = (
    id: string,
    loincCode: string,
    loincDisplay: string,
    value: string,
    unit: string,
    systemUnit: string,
    codes?: ClinicalCoding[]
  ): any => {
    const codings = (codes && codes.length > 0) 
      ? codes.map(c => ({ system: c.system, code: c.code, display: c.display }))
      : [{ system: "http://loinc.org", code: loincCode, display: loincDisplay }];

    return {
      resourceType: "Observation",
      id: id,
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "vital-signs",
              display: "Vital Signs"
            }
          ]
        }
      ],
      code: {
        coding: codings,
        text: loincDisplay
      },
      subject: {
        reference: `urn:uuid:Patient/${patientId}`
      },
      encounter: {
        reference: `urn:uuid:Encounter/${encounterId}`
      },
      effectiveDateTime: vitals.timeOfVitals.value ? `${patientHeader.dateOfArrival.value || "2026-05-21"}T${vitals.timeOfVitals.value}:00Z` : undefined,
      valueQuantity: value ? {
        value: parseFloat(value) || value,
        unit: unit,
        system: "http://unitsofmeasure.org",
        code: systemUnit
      } : undefined
    };
  };

  // 5a. Blood Pressure Panel (Special multi-component Observation structure)
  if (vitals.bpSystolic.value || vitals.bpDiastolic.value) {
    const bpObs: any = {
      resourceType: "Observation",
      id: "obs-blood-pressure",
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "vital-signs",
              display: "Vital Signs"
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "85354-9",
            display: "Blood pressure panel with systolic and diastolic"
          }
        ],
        text: "Blood Pressure"
      },
      subject: {
        reference: `urn:uuid:Patient/${patientId}`
      },
      encounter: {
        reference: `urn:uuid:Encounter/${encounterId}`
      },
      effectiveDateTime: vitals.timeOfVitals.value ? `${patientHeader.dateOfArrival.value || "2026-05-21"}T${vitals.timeOfVitals.value}:00Z` : undefined,
      component: []
    };

    if (vitals.bpSystolic.value) {
      bpObs.component.push({
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8480-6",
              display: "Systolic blood pressure"
            }
          ]
        },
        valueQuantity: {
          value: parseFloat(vitals.bpSystolic.value) || vitals.bpSystolic.value,
          unit: "mmHg",
          system: "http://unitsofmeasure.org",
          code: "mm[Hg]"
        }
      });
    }

    if (vitals.bpDiastolic.value) {
      bpObs.component.push({
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8462-4",
              display: "Diastolic blood pressure"
            }
          ]
        },
        valueQuantity: {
          value: parseFloat(vitals.bpDiastolic.value) || vitals.bpDiastolic.value,
          unit: "mmHg",
          system: "http://unitsofmeasure.org",
          code: "mm[Hg]"
        }
      });
    }

    entry.push({
      fullUrl: "urn:uuid:Observation/obs-blood-pressure",
      resource: bpObs
    });
  }

  // 5b. Heart Rate observation
  if (vitals.heartRate.value) {
    entry.push({
      fullUrl: "urn:uuid:Observation/obs-heart-rate",
      resource: createVitalObservation(
        "obs-heart-rate",
        "8867-4",
        "Heart rate",
        vitals.heartRate.value,
        "bpm",
        "/min",
        vitals.heartRate.codes
      )
    });
  }

  // 5c. Respiratory Rate observation
  if (vitals.respiratoryRate.value) {
    entry.push({
      fullUrl: "urn:uuid:Observation/obs-resp-rate",
      resource: createVitalObservation(
        "obs-resp-rate",
        "9279-1",
        "Respiratory rate",
        vitals.respiratoryRate.value,
        "breaths/min",
        "/min",
        vitals.respiratoryRate.codes
      )
    });
  }

  // 5d. Oxygen Saturation (SpO2) observation
  if (vitals.spo2.value) {
    const spo2Obs = createVitalObservation(
      "obs-spo2",
      "2708-6",
      "Oxygen saturation",
      vitals.spo2.value,
      "%",
      "%",
      vitals.spo2.codes
    );
    // Add supplemental detail if room air or Oxygen flow specified
    if (vitals.spo2Mechanism.value || vitals.spo2FlowRate.value) {
      spo2Obs.component = [];
      if (vitals.spo2Mechanism.value) {
        spo2Obs.component.push({
          code: { text: "Oxygen delivery mechanism" },
          valueString: vitals.spo2Mechanism.value + (vitals.spo2Device.value ? ` (${vitals.spo2Device.value})` : "")
        });
      }
      if (vitals.spo2FlowRate.value) {
        spo2Obs.component.push({
          code: { text: "Oxygen flow rate" },
          valueString: vitals.spo2FlowRate.value
        });
      }
    }
    entry.push({
      fullUrl: "urn:uuid:Observation/obs-spo2",
      resource: spo2Obs
    });
  }

  // 5e. Temperature observation
  if (vitals.temperature.value) {
    const isCelsius = vitals.temperature.value.includes("C") || parseFloat(vitals.temperature.value) < 45;
    const unitText = isCelsius ? "C" : "F";
    const unitCode = isCelsius ? "Cel" : "[degF]";
    const tempObs = createVitalObservation(
      "obs-body-temp",
      "8310-5",
      "Body temperature",
      vitals.temperature.value.replace(/[^0-9.]/g, ""),
      unitText,
      unitCode,
      vitals.temperature.codes
    );
    if (vitals.temperatureRoute.value) {
      tempObs.bodySite = { text: vitals.temperatureRoute.value };
    }
    entry.push({
      fullUrl: "urn:uuid:Observation/obs-body-temp",
      resource: tempObs
    });
  }

  // 5f. Blood Glucose observation
  if (vitals.bloodGlucose.value) {
    const gUnit = vitals.bloodGlucoseUnit.value || "mmol/L";
    const gUnitCode = gUnit === "mmol/L" ? "mmol/L" : "mg/dL";
    entry.push({
      fullUrl: "urn:uuid:Observation/obs-blood-glucose",
      resource: createVitalObservation(
        "obs-blood-glucose",
        "15074-8",
        "Glucose in blood",
        vitals.bloodGlucose.value,
        gUnit,
        gUnitCode,
        vitals.bloodGlucose.codes
      )
    });
  }

  // 6. Working Diagnosis (Encounter Condition)
  const courseOfAction = record.courseOfAction;
  if (courseOfAction.workingDiagnosis.value) {
    const workingDiagCodes: ClinicalCoding[] = courseOfAction.workingDiagnosis.codes || [
      {
        system: "http://hl7.org/fhir/sid/icd-10",
        code: "R07.9",
        display: "Chest pain, unspecified",
        standard: "ICD-10"
      }
    ];

    const fhirWD: any = {
      resourceType: "Condition",
      id: "cond-working-diagnosis",
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active"
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: "differential"
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "encounter-diagnosis",
              display: "Encounter Diagnosis"
            }
          ]
        }
      ],
      code: {
        coding: workingDiagCodes.map((c) => ({
          system: c.system,
          code: c.code,
          display: c.display
        })),
        text: courseOfAction.workingDiagnosis.value
      },
      subject: {
        reference: `urn:uuid:Patient/${patientId}`
      },
      encounter: {
        reference: `urn:uuid:Encounter/${encounterId}`
      }
    };
    entry.push({
      fullUrl: "urn:uuid:Condition/cond-working-diagnosis",
      resource: fhirWD
    });
  }

  // 7. Initial Investigations - Lab and Imaging requests
  const investigations = record.investigations;
  const buildLabServiceRequest = (id: string, label: string, isOrdered: boolean, loinc: string, cpt: string) => {
    if (!isOrdered) return;
    const fhirSR: any = {
      resourceType: "ServiceRequest",
      id: id,
      status: "active",
      intent: "order",
      category: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "108252007",
              display: "Laboratory procedure"
            }
          ]
        }
      ],
      code: {
        coding: [
          { system: "http://loinc.org", code: loinc, display: label },
          { system: "http://www.ama-assn.org/go/cpt", code: cpt, display: `${label} (procedure)` }
        ],
        text: label
      },
      subject: { reference: `urn:uuid:Patient/${patientId}` },
      encounter: { reference: `urn:uuid:Encounter/${encounterId}` }
    };
    entry.push({
      fullUrl: `urn:uuid:ServiceRequest/${id}`,
      resource: fhirSR
    });
  };

  buildLabServiceRequest("sr-lab-fbc", "Full Blood Count (FBC)", investigations.labFbcOrdered.value === true, "58410-2", "85025");
  buildLabServiceRequest("sr-lab-ue", "Urea & Electrolytes (U&E)", investigations.labUeOrdered.value === true, "24362-6", "80069");
  buildLabServiceRequest("sr-lab-lft", "Liver Function Tests (LFT)", investigations.labLftOrdered.value === true, "24363-4", "80076");
  buildLabServiceRequest("sr-lab-coags", "Coagulation Studies", investigations.labCoagsOrdered.value === true, "34534-8", "85610");
  buildLabServiceRequest("sr-lab-troponin", "Cardiac Troponin Test", investigations.labTroponinOrdered.value === true, "49171-2", "84484");

  // Other Lab Orders
  if (investigations.labOther.value) {
    entry.push({
      fullUrl: "urn:uuid:ServiceRequest/sr-lab-other",
      resource: {
        resourceType: "ServiceRequest",
        id: "sr-lab-other",
        status: "active",
        intent: "order",
        code: { text: investigations.labOther.value },
        subject: { reference: `urn:uuid:Patient/${patientId}` }
      }
    });
  }

  // Imaging Service Requests
  const buildImagingServiceRequest = (id: string, label: string, isOrdered: boolean, region: string, sctCode: string, cpt: string) => {
    if (!isOrdered) return;
    const fhirSR: any = {
      resourceType: "ServiceRequest",
      id: id,
      status: "active",
      intent: "order",
      category: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "363679005",
              display: "Imaging procedure"
            }
          ]
        }
      ],
      code: {
        coding: [
          { system: "http://snomed.info/sct", code: sctCode, display: `${label} of ${region || "specified body site"}` },
          { system: "http://www.ama-assn.org/go/cpt", code: cpt, display: `${label} procedure` }
        ],
        text: `${label} ${region ? `Region: ${region}` : ""}`
      },
      subject: { reference: `urn:uuid:Patient/${patientId}` },
      encounter: { reference: `urn:uuid:Encounter/${encounterId}` }
    };
    entry.push({
      fullUrl: `urn:uuid:ServiceRequest/${id}`,
      resource: fhirSR
    });
  };

  buildImagingServiceRequest("sr-img-xray", "Plain Radiography (X-Ray)", investigations.imgXrayOrdered.value === true, investigations.imgXrayRegion.value, "399208008", "71045");
  buildImagingServiceRequest("sr-img-ct", "Computed Tomography (CT), Regional", investigations.imgCtOrdered.value === true, investigations.imgCtRegion.value, "11634002", "70450");
  buildImagingServiceRequest("sr-img-ultrasound", "Diagnostic Ultrasound", investigations.imgUltrasoundOrdered.value === true, investigations.imgUltrasoundDetail.value, "16310003", "76700");
  buildImagingServiceRequest("sr-img-mri", "Magnetic Resonance Imaging (MRI)", investigations.imgMriOrdered.value === true, investigations.imgMriDetail.value, "113091000", "72141");

  // Investigation Observations (Urinalysis / ECG / ABG result logs)
  if (investigations.ecgResult.value) {
    entry.push({
      fullUrl: "urn:uuid:Observation/obs-ecg-finding",
      resource: {
        resourceType: "Observation",
        id: "obs-ecg-finding",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "11524-6", display: "ECG Study report Interpretation" }],
          text: "Electrocardiogram (ECG) Evaluation"
        },
        subject: { reference: `urn:uuid:Patient/${patientId}` },
        valueString: investigations.ecgResult.value,
        effectiveDateTime: investigations.ecgTime.value ? `${patientHeader.dateOfArrival.value || "2026-05-21"}T${investigations.ecgTime.value}:00Z` : undefined
      }
    });
  }

  if (investigations.urinalysisResult.value) {
    entry.push({
      fullUrl: "urn:uuid:Observation/obs-urinalysis",
      resource: {
        resourceType: "Observation",
        id: "obs-urinalysis",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "24357-6", display: "Urinalysis panel - Urine" }],
          text: "Urinalysis Diagnostic Observation"
        },
        subject: { reference: `urn:uuid:Patient/${patientId}` },
        valueString: investigations.urinalysisResult.value
      }
    });
  }

  if (investigations.vbgAbgResult.value) {
    entry.push({
      fullUrl: "urn:uuid:Observation/obs-blood-gas",
      resource: {
        resourceType: "Observation",
        id: "obs-blood-gas",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "24338-6", display: "Gas/electrolyte panel - Blood" }],
          text: "VBG/ABG Balance Analysis"
        },
        subject: { reference: `urn:uuid:Patient/${patientId}` },
        valueString: investigations.vbgAbgResult.value
      }
    });
  }

  // 8. Immediate Interventions (Procedure)
  if (courseOfAction.immediateInterventions.value) {
    const interventionCodes: ClinicalCoding[] = courseOfAction.immediateInterventions.codes || [];
    const fhirProc: any = {
      resourceType: "Procedure",
      id: "proc-ed-intervention",
      status: "completed",
      code: {
        coding: interventionCodes.map((c) => ({
          system: c.system,
          code: c.code,
          display: c.display
        })),
        text: courseOfAction.immediateInterventions.value
      },
      subject: { reference: `urn:uuid:Patient/${patientId}` },
      encounter: { reference: `urn:uuid:Encounter/${encounterId}` }
    };
    entry.push({
      fullUrl: "urn:uuid:Procedure/proc-ed-intervention",
      resource: fhirProc
    });
  }

  // 9. Processed Medications (MedicationRequest)
  if (courseOfAction.medications && Array.isArray(courseOfAction.medications)) {
    courseOfAction.medications.forEach((med, idx) => {
      const medId = `med-req-${idx + 1}`;
      const medCodes: ClinicalCoding[] = med.codes || [];

      const fhirMedReq: any = {
        resourceType: "MedicationRequest",
        id: medId,
        status: "active",
        intent: "order",
        subject: { reference: `urn:uuid:Patient/${patientId}` },
        encounter: { reference: `urn:uuid:Encounter/${encounterId}` },
        medicationCodeableConcept: {
          coding: medCodes.map((c) => ({
            system: c.system,
            code: c.code,
            display: c.display
          })),
          text: med.drug
        },
        dosageInstruction: [
          {
            text: `${med.dose} via ${med.route} administration. Sign-off: ${med.sign}`,
            route: { text: med.route },
            timing: {
              event: med.time ? [ `${patientHeader.dateOfArrival.value || "2026-05-21"}T${med.time}:00Z` ] : []
            }
          }
        ]
      };
      
      entry.push({
        fullUrl: `urn:uuid:MedicationRequest/${medId}`,
        resource: fhirMedReq
      });
    });
  }

  // 10. Referrals and Dispositions (Extension of Encounter or separate resources)
  if (courseOfAction.disposition.value) {
    // Add encounter discharge disposition details
    fhirEncounter.hospitalization = {
      dischargeDisposition: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/discharge-disposition",
            code: courseOfAction.disposition.value.toLowerCase().includes("discharge") ? "home" : "other-hcf",
            display: courseOfAction.disposition.value
          }
        ],
        text: `${courseOfAction.disposition.value}: ${courseOfAction.dispositionDetails.value}`
      }
    };
  }

  // Build the complete transaction Bundle
  const bundle = {
    resourceType: "Bundle",
    id: "bundle-clinical-assessment-intake",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: entry
  };

  return bundle;
}
