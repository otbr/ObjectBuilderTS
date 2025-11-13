# ActionScript Blueprint

## ⚠️ IMPORTANT: This Folder is a Blueprint for TypeScript Conversion

**This folder contains the original ActionScript source code from the Adobe AIR/Flash version of Object Builder.**

### Purpose

This folder serves as a **reference blueprint** for the TypeScript conversion project. The ActionScript code here should be used as a guide when:

- Implementing new TypeScript features
- Understanding the original architecture and design patterns
- Debugging issues by comparing with the original implementation
- Ensuring feature parity during conversion

### Status

The TypeScript conversion is **~93% complete**. Most of the backend functionality has been converted, and the UI is being rebuilt using React and Electron.

### Structure

This folder contains **all legacy files** from the original Adobe AIR application, including source code, build outputs, runtime files, and configuration:

```
actionscript-blueprint/
├── Adobe AIR/        # Adobe AIR runtime files
├── bin/              # Build output (compiled SWF, EXE, metadata)
├── bin-debug/        # Debug build output
├── META-INF/         # AIR package metadata
├── libs/             # ActionScript compiled libraries (.swc files)
├── locale/           # Localization files (en_US, es_ES, pt_BR)
├── workerswfs/       # Worker thread SWF files
│
├── Source Code:
│   ├── com/          # Third-party libraries (mignari)
│   ├── gamelib/      # Game library utilities
│   ├── nail/         # Nail framework components
│   ├── ob/           # Object Builder specific code
│   │   ├── commands/ # Command pattern implementations
│   │   ├── components/ # UI components (MXML)
│   │   ├── hotkeys/  # Hotkey management
│   │   └── ...
│   ├── objectview/   # Object viewer components
│   ├── otlib/        # Open Tibia library
│   │   ├── animation/ # Animation system
│   │   ├── components/ # UI components
│   │   ├── core/     # Core classes
│   │   ├── things/   # Thing type system
│   │   ├── sprites/  # Sprite system
│   │   └── ...
│   ├── slicer/       # Sprite slicer tool
│   ├── store/        # Asset store
│   ├── ObjectBuilder.mxml # Main application file
│   └── ObjectBuilderWorker.as # Worker thread implementation
│
├── Configuration Files:
│   ├── asconfig.json # ActionScript compiler configuration
│   ├── ObjectBuilder-app.xml # AIR application descriptor
│   ├── ObjectBuilder.css # Application stylesheet
│   ├── sprites.xml   # Default sprite configuration
│   └── versions.xml  # Default version configuration
│
└── Compiled Files:
    ├── ObjectBuilder.exe # Packaged AIR executable
    ├── ObjectBuilder.swf # Compiled main application
    ├── ObjectBuilderWorker.swf # Compiled worker
    └── mimetype # AIR package mimetype
```

### File Types

- **`.as` files**: ActionScript 3.0 source code
- **`.mxml` files**: Adobe Flex MXML UI component definitions

### For Future Developers/Agents

When working on this project:

1. **Reference this folder** when implementing new features or fixing bugs
2. **Compare implementations** between ActionScript and TypeScript to ensure correctness
3. **Preserve the architecture** - the original design patterns should be maintained
4. **Do NOT modify** files in this folder - it is a historical reference
5. **Use as documentation** - the ActionScript code serves as inline documentation

### Conversion Notes

- The TypeScript version uses Node.js instead of Adobe AIR
- UI is rebuilt with React instead of Flex/MXML
- Electron is used for desktop app instead of AIR runtime
- File operations use Node.js `fs` instead of AIR File API
- Image processing uses `sharp`/`canvas` instead of Flash BitmapData

### Complete List of Legacy Files

This folder contains **all files** from the original Adobe AIR application:

#### Source Code
- **244 ActionScript files** (`.as` and `.mxml`) - Original source code
- All source directories preserved with original structure

#### Adobe AIR Runtime
- `Adobe AIR/` - Adobe AIR runtime DLLs and support files
- `META-INF/` - AIR package metadata and signatures
- `mimetype` - AIR package mimetype declaration

#### Build Output
- `bin/` - Production build output (SWF, EXE, icons, metadata)
- `bin-debug/` - Debug build output
- `ObjectBuilder.exe` - Packaged AIR executable
- `ObjectBuilder.swf` - Compiled main application
- `ObjectBuilderWorker.swf` - Compiled worker thread

#### Libraries
- `libs/` - ActionScript compiled libraries (`.swc` files):
  - `blooddy_crypto.swc` - Crypto library
  - `mignari_assets.swc` - Mignari assets library
  - `mignari_core.swc` - Mignari core library
  - `mignari.swc` - Mignari main library
  - `NailLib.swc` - Nail framework library

#### Configuration
- `asconfig.json` - ActionScript compiler configuration
- `ObjectBuilder-app.xml` - AIR application descriptor
- `ObjectBuilder.css` - Application stylesheet
- `locale/` - Localization files (English, Spanish, Portuguese)
- `sprites.xml` - Default sprite configuration
- `versions.xml` - Default version configuration

#### Workers
- `workerswfs/` - Worker thread SWF files
- `Workers.as` - Worker definitions

#### Other
- `dsound.dll` - DirectSound library (legacy Windows dependency)

### Original Technology Stack

- **Language**: ActionScript 3.0
- **Framework**: Adobe Flex
- **Runtime**: Adobe AIR
- **UI**: MXML + ActionScript
- **Build**: Apache Flex SDK / Flash Builder

---

**Note**: This folder is read-only. All active development happens in the TypeScript codebase in the `src/` folder.

