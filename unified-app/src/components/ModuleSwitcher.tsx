/**
 * ModuleSwitcher - Tab UI for switching between modules
 */

import type { ModuleId, ModuleInfo } from '../types';

interface ModuleSwitcherProps {
  modules: ModuleInfo[];
  enabledModules: Record<string, boolean>;
  activeModule: ModuleId;
  onModuleChange: (moduleId: ModuleId) => void;
}

export function ModuleSwitcher({
  modules,
  enabledModules,
  activeModule,
  onModuleChange,
}: ModuleSwitcherProps) {
  // Filter to only show enabled modules
  const visibleModules = modules.filter(
    (m) => enabledModules[m.id] !== false // Show if true or undefined (default enabled)
  );

  return (
    <div role="tablist" className="tabs tabs-boxed bg-base-200">
      {visibleModules.map((module) => (
        <button
          key={module.id}
          role="tab"
          className={`tab gap-2 ${activeModule === module.id ? 'tab-active' : ''}`}
          onClick={() => onModuleChange(module.id)}
          title={module.description}
        >
          <span className="text-lg">{module.icon}</span>
          <span className="hidden sm:inline">{module.name}</span>
        </button>
      ))}
    </div>
  );
}
