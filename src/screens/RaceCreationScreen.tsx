import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { StepContainer } from '../components/race-creation/StepContainer';
import { StepDebugModal } from '../components/race-creation/StepDebugModal';
import { Step1 } from '../components/race-creation/Step1';
import { Step2 } from '../components/race-creation/Step2';
import { Step3 } from '../components/race-creation/Step3';
import { Step4 } from '../components/race-creation/Step4';
import { Step5 } from '../components/race-creation/Step5';
import { Step6 } from '../components/race-creation/Step6';

import { listFoodItems } from '../db/repos/food-item-repo';
import { getOrCreateProfile } from '../db/repos/profile-repo';
import type { FoodItem } from '../models/food-item';
import type { Profile } from '../models/profile';
import type { RaceCreationDraft, CreationStep } from '../services/race-creation-store';
import { useRaceCreationStore } from '../services/race-creation-store';
import { isStepValid } from '../services/race-creation-validation';
import { useDatabase } from '../hooks/use-database';

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function RaceCreationScreen() {
  const dbState = useDatabase();
  const { currentStep, draft, setStep, updateDraft } = useRaceCreationStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [debugVisible, setDebugVisible] = useState(false);
  const loadedRef = useRef(false);

  const { width } = useWindowDimensions();
  const chartWidth = width - 40; // 20px padding each side

  useEffect(() => {
    if (dbState.status !== 'ready' || loadedRef.current) return;
    loadedRef.current = true;
    getOrCreateProfile(dbState.db).then(setProfile);
    listFoodItems(dbState.db).then(setFoodItems);
  }, [dbState]);

  const canNext = isStepValid(currentStep, draft);

  function goNext() {
    if (!canNext) return;
    if (currentStep < 6) {
      setStep((currentStep + 1) as CreationStep);
    } else {
      // Bloc D: navigate to preview screen (not yet implemented).
      router.push('/race-preview' as never);
    }
  }

  function goBack() {
    if (currentStep > 1) {
      setStep((currentStep - 1) as CreationStep);
    } else {
      router.back();
    }
  }

  if (dbState.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  const stepProps = { draft, updateDraft, profile, foodItems };

  return (
    <>
      <StepContainer
        step={currentStep}
        canNext={canNext}
        onNext={goNext}
        onBack={goBack}
        onDebug={__DEV__ ? () => setDebugVisible(true) : undefined}
      >
        {currentStep === 1 && <Step1 draft={draft} updateDraft={updateDraft} />}
        {currentStep === 2 && (
          <Step2
            draft={draft}
            updateDraft={updateDraft}
            profile={profile}
            chartWidth={chartWidth}
          />
        )}
        {currentStep === 3 && <Step3 draft={draft} updateDraft={updateDraft} />}
        {currentStep === 4 && <Step4 draft={draft} updateDraft={updateDraft} />}
        {currentStep === 5 && <Step5 draft={draft} updateDraft={updateDraft} />}
        {currentStep === 6 && (
          <Step6 {...stepProps} />
        )}
      </StepContainer>

      {__DEV__ && (
        <StepDebugModal
          draft={draft}
          visible={debugVisible}
          onClose={() => setDebugVisible(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
