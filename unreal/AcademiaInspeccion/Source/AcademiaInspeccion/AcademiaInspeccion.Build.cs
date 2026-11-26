using UnrealBuildTool;

public class AcademiaInspeccion : ModuleRules
{
	public AcademiaInspeccion(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] {
			"Core", "CoreUObject", "Engine", "InputCore",
			"Json", "JsonUtilities", "Slate", "SlateCore"
		});
		PrivateDependencyModuleNames.AddRange(new string[] { "ApplicationCore" });
	}
}
