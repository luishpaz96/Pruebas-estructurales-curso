#pragma once

// Taller de mantenimiento (port de js/maintenance.js): lista de seguridad y pasos guiados
// (clic en la pieza del modelo 3D + elegir la acción). Se muestra en el panel derecho
// mientras la cámara enfoca la máquina 3D.

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"
#include "CourseContent.h"

class SAcademiaShell;
class UAcademiaGameInstance;
class AInspectionMachine;
class SBox;

class ACADEMIAINSPECCION_API SMaintenanceView : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SMaintenanceView) {}
		SLATE_ARGUMENT(TWeakPtr<SAcademiaShell>, Shell)
		SLATE_ARGUMENT(const FMaintProc*, Proc)
		SLATE_ARGUMENT(TWeakObjectPtr<AInspectionMachine>, Machine)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);
	virtual ~SMaintenanceView() override;

private:
	enum class EPhase : uint8 { Safety, Steps, Result };

	UAcademiaGameInstance* GI() const;
	void ResetState();
	void Refresh();
	TSharedRef<SWidget> BuildSafety();
	TSharedRef<SWidget> BuildStep();
	TSharedRef<SWidget> BuildResult();

	void ShuffleActions();
	void SelectPart(const FString& Part);
	void DoAction(const FString& Action);
	void Finish();
	void Restart();
	TArray<FString> ListableParts() const;
	FString ErrorsText() const;

	TWeakPtr<SAcademiaShell> Shell;
	const FMaintProc* Proc = nullptr;
	TWeakObjectPtr<AInspectionMachine> Machine;
	TSharedPtr<SBox> BodyBox;

	EPhase Phase = EPhase::Safety;
	int32 Step = 0;
	float Errors = 0.f;
	bool bSafetyFault = false;
	bool bEstopDone = false;
	bool bFallbackOpen = false;
	int32 Pct = 0;
	FString Chosen;
	TArray<bool> Checked;
	TArray<FString> ActionOrder;
	int32 HookToken = 0;
};
