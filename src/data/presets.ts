import { PresetCase } from "../types";

export const PRESET_CASES: PresetCase[] = [
  {
    key: "chest-pain-clear",
    name: "Clear Case: Acute Chest Pain (US/EU Standard)",
    type: "clear",
    tags: ["High Clarity", "Cardiac", "US Standard"],
    transcript: `Doctor: Hello. Can you state your full name and date of birth?
Patient: Hello doctor, my name is John Miller, born August 12, 1978. I am 47 years old.
Doctor: Excellent. John, what brings you to the emergency department today?
Patient: I had sudden, crushing chest pain start about 2 hours ago. It's a severe pressure right in the middle of my chest.
Doctor: Scale of 0 to 10, how is the pain?
Patient: It is easily an 8 out of 10.
Doctor: Any medical history or allergies?
Patient: I have hypertension. No allergies, No known drug allergies, or NKDA.
Doctor: Let's get your vitals. Nurse, please record.
Nurse: Yes doctor. Time is 10:15 AM. BP is systolic 145 diastolic 90, heart rate is 92, regular. Respiratory rate is 18, temperature is 37.2 degrees Celsius taken tympanically. SpO2 is 98 percent on room air. Blood glucose is 110 mg/dL.
Doctor: Thank you. Let's do a bedside ECG immediately and order a full blood count, BMP, and cardiac troponin.
Nurse: I've also scheduled a chest x-ray. Bedside ECG is showing clear normal sinus rhythm.
Doctor: Let's give him nitroglycerin sublingually. Working diagnosis is acute coronary syndrome.`,
    explanation: "Standard clear clinical case containing clear identifiers, vital signs, allergies, and clear chief complaints. Extraction confidence should be almost entirely High (Blue)."
  },
  {
    key: "hinglish-realistic",
    name: "Realistic Case: Bilingual Patient presenting with Fever & Dyspnea (India/SA Standard)",
    type: "realistic",
    tags: ["Bilingual", "Hinglish", "Fever", "India Layout"],
    transcript: `Doctor: Hello, please tell me your name.
Relative: Inka naam Rajesh Kumar hai. Age around 55 years.
Doctor: Rajesh ji, kya takleef hai aapko?
Patient: Mujhe teen din se bahut zyada bukhar hai doctor, aur saas lene mein bhi dikkat ho rahi hai. Pain around 6 out of 10 in the chest while coughing.
Doctor: Rajesh Kumar, Rajesh ji, temperature check karte hain pehle. Temp is 99 degrees Fahrenheit, mild fever. Aur allergies hai koi?
Relative: Haan, inko penicillin se allergy hai, last time penicillin injection pe heavy rash ho gaya tha.
Doctor: Penicillin allergy is noted. Let's get his vitals. Blood pressure has been taken.
Relative: Blood pressure 120 by 80 hai abhi check kiya tha.
Doctor: Pulse rate 72, normal sinus rhythm. Respiratory rate appears shallow, RR is 22 breaths per minute. Oxygen saturation SpO2 94 on room air. Let's put him on 2 litres oxygen via nasal cannula. Sugar level check kiya?
Relative: Haan, randomly sugar kiya tha ghar pe. Glucose is 110.
Doctor: Perfect. Let's order a portable chest X-Ray and send CBC, U&E and urgent Trop T.
Relative: Xray abhi karwayenge?
Doctor: Haan, right away. Immediate interventions given are IV saline, paracetamol for fever, and supplemental oxygen. Working diagnosis is suspicious community acquired pneumonia.`,
    explanation: "Realistic bilingual conversion containing Hindi phrases ('Teen din se bukhar', 'saas lene mein dikkat'). Testing the engine's translation ability and units conversion to Celsius."
  },
  {
    key: "confused-invalid",
    name: "Invalid Case: Confused Dialogue & Disorganized Spoken Readings",
    type: "invalid",
    tags: ["Noisy", "Mismatched", "Extreme values"],
    transcript: `Doctor: Hello. Can you help me check this patient? What is the blood pressure?
Nurse: The BP is headache walking fever. Oh wait, I mean the patient says he has a headache. He also says BP started tomorrow.
Doctor: That doesn't make sense. What is her temperature?
Patient: My temperature is five hundred degrees, doctor! I am burning.
Nurse: Actually, his temperature seems 37 degrees. He is just exaggerating.
Doctor: Alright, can you check urine? Is it positive for something?
Nurse: Urine is positive for ECG, no wait, urine is positive for sugar level.
Doctor: What about imaging?
Nurse: Urinalysis shows no blood. Let's do an ultrasound heart rate 300.
Patient: My allergy is insulin. Or maybe penicillin? No, my blood group is AB. I don't know my allergies.`,
    explanation: "Designed to represent highly ambiguous, confused speech with contradictory inputs. The extraction engine should flag these values with Low (Red) confidence or skip completely to show blank formatting."
  },
  {
    key: "unconscious-relative",
    name: "Special Case: Unconscious Patient reported by Spouse (Australia/ANZ UR Schema)",
    type: "special",
    tags: ["Relative Report", "Unconscious", "Australia Layout"],
    transcript: `Doctor: G'day, can you tell me what happened?
Relative: I found him collapsed on the floor in the kitchen. He wouldn't wake up! He was just groaning.
Doctor: Do you know his name?
Relative: Yes, he's Arthur Pendelton. His DOB is 14 November 1963. He is 62. His Australian Medicare card number is 4455-6677.
Doctor: Okay, let's assess Arthur. His eyes open only to pain. Arthur, can you hear me?
Relative: He's not really talking, just making confused sounds.
Doctor: Eyes opening to pain is GCS Eye 2. Confused speech is GCS Verbal 4. Let's check GCS Motor... Arthur, squeeze my hand... He is withdrawing from pain, so Motor is 4. Total GCS seems about 10 out of 15.
Doctor: Any allergies, love?
Relative: No known allergies, mate. No known drug allergies at all.
Doctor: Let's record his vitals. Blood pressure is 150 over 95. Heart rate is 110, irregular, which sounds like atrial fibrillation. Breathing is shallow, RR is 24 breaths/min. Oxygen saturation is 91 percent on room air, so let's start him on 4 litres oxygen via simple face mask.
Relative: Arthur has a history of pacemaker, so we can't do an MRI!
Doctor: Excellent save. MRI is contraindicated. Let's order an emergency FAST bedside ultrasound to check for internal fluid, and order urgent VBG, CBC and Troponins. Working diagnosis is acute hemorrhagic stroke vs severe sepsis.`,
    explanation: "Unconscious presentation using Australia/New Zealand terminology ('mate', 'G'day', 'Medicare'). Tests GCS parsing (Eye: 2, Verbal: 4, Motor: 4, Total: 10), and tracks MRI contraindication."
  },
  {
    key: "missing-performance",
    name: "Performance Case: High Density & Extremely Minimal (Not Communicated)",
    type: "performance",
    tags: ["Sparse Data", "Missing Fields", "Telemetry"],
    transcript: `Doctor: High density case, limited details. Patient was found wandering in parking lot. Unidentified male, approximately 30 years old, no MRN. Name not communicated, address and emergency contact details are not known. Chief complaint appears to be disorientation. Duration of disorientation is unknown, no HPI onset, duration or severity details. Allergies - allergy history is unavailable. Working diagnosis: acute confusional state, plan discharge home excluded, transfer to psychiatric assessment unit or admit to ward. Follow up review is not determined.`,
    explanation: "Dense, sparse clinical narrative where almost every detail is unavailable ('not known', 'not communicated'). This evaluates the engine's capability of preserving blanks while retaining correct structured fields."
  }
];
