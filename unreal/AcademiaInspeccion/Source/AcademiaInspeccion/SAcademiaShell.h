#pragma once

// Contenedor de toda la interfaz: barra superior (nivel/XP/misión), panel de vista actual,
// diálogo del mentor y avisos. Las vistas (lección, examen, práctica, mantenimiento, software)
// se abren con los métodos Open*; al cerrar la última vista se regresa a caminar por la línea.

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"
#include "CourseContent.h"

class UAcademiaGameInstance;
class AAcademiaPlayerController;
class AInspectionMachine;
class SBox;
class SVerticalBox;
class SOverlay;

// Dónde se acomoda la vista: pantalla completa o panel derecho (deja ver la máquina 3D)
enum class EShellLayout : uint8 { Full, RightPanel };

class ACADEMIAINSPECCION_API SAcademiaShell : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SAcademiaShell) {}
		SLATE_ARGUMENT(TWeakObjectPtr<AAcademiaPlayerController>, Owner)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);
	virtual ~SAcademiaShell() override;

	UAcademiaGameInstance* GI() const;
	AAcademiaPlayerController* PC() const { return Owner.Get(); }

	// Navegación. Cada Open* apila la vista; Back() regresa a la anterior; CloseAll() vuelve al 3D.
	void PushView(TSharedRef<SWidget> View, EShellLayout Layout = EShellLayout::Full);
	void Back();
	void CloseAll();
	bool IsViewOpen() const { return Stack.Num() > 0; }

	void ShowMainMenu();
	void ShowCareer();
	void ShowMachineHub(const FString& MachineId);
	void ShowSettings();
	void ShowProfile();
	void OpenModule(const FCourseModule& Module);
	void OpenLesson(const FCourseModule& Module, int32 LessonIndex);
	void OpenExam(const FCourseExam& Exam, const FString& Title);
	void OpenReviewBank();
	void OpenPractice(const FPractice& Practice);
	void OpenMaintenance(const FMaintProc& Proc);
	void OpenSoftware(const FString& Mode, const FString& MachineId);

	// Diálogo del mentor (abajo, estilo juego). OnDone se llama al terminar las líneas.
	void ShowDialog(const FString& Speaker, const TArray<FString>& Lines, TFunction<void()> OnDone = nullptr);
	bool IsDialogOpen() const { return DialogLines.Num() > 0; }
	void AdvanceDialog();

	// Pregunta rápida del mentor (tarea Quiz de una misión)
	void ShowQuiz(const FExamQuestion& Q, TFunction<void(bool)> OnAnswered);

	void Toast(const FString& Msg);
	void Celebrate();
	// Texto de ayuda contextual abajo al centro ("E: usar AOI V510")
	void SetHint(const FString& Hint);

	// El mantenimiento recibe clics en piezas 3D a través del controlador
	TFunction<void(const FString& /*Part*/)> OnPartPicked;
	TFunction<void(const FString& /*Part*/)> OnPartHovered;

	virtual void Tick(const FGeometry& AllottedGeometry, const double InCurrentTime, const float InDeltaTime) override;
	virtual bool SupportsKeyboardFocus() const override { return true; }
	virtual FReply OnKeyDown(const FGeometry& MyGeometry, const FKeyEvent& InKeyEvent) override;

private:
	TSharedRef<SWidget> BuildTopBar();
	TSharedRef<SWidget> BuildDialogBox();
	void RefreshView();
	void HandleMissionChanged(const struct FCareerMission* Mission, bool bCompleted);
	void RunActiveTask();

	TWeakObjectPtr<AAcademiaPlayerController> Owner;
	struct FEntry { TSharedRef<SWidget> Widget; EShellLayout Layout; };
	TArray<FEntry> Stack;

	TSharedPtr<SBox> FullSlot;
	TSharedPtr<SBox> RightSlot;
	TSharedPtr<SVerticalBox> ToastBox;
	TSharedPtr<class SConfetti> ConfettiWidget;
	bool bToastsDirty = false;
	FString HintText;

	FString DialogSpeaker;
	TArray<FString> DialogLines;
	int32 DialogIndex = 0;
	TFunction<void()> DialogDone;

	struct FToast { FString Msg; double Until; };
	TArray<FToast> Toasts;
	double CelebrateUntil = 0;
	FDelegateHandle ToastHandle, MissionHandle, CelebrateHandle;
};
