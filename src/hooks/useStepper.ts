import { useState } from 'react';
import { Step } from '../types/wallet';

export const useStepper = (initialSteps: Step[]) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps] = useState<Step[]>(initialSteps);

  const handleNext = (condition: boolean) => {
    if (condition && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      return true;
    }
    return false;
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      return true;
    }
    return false;
  };

  const resetStepper = () => {
    setCurrentStep(0);
  };

  return {
    currentStep,
    steps,
    handleNext,
    handlePrevious,
    resetStepper,
    setCurrentStep
  };
};
