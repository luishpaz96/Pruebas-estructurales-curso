using UnrealBuildTool;
using System.Collections.Generic;

public class AcademiaInspeccionEditorTarget : TargetRules
{
	public AcademiaInspeccionEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("AcademiaInspeccion");
	}
}
