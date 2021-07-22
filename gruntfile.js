"use strict";

//-- Grunt confiration file
//-- https://gruntjs.com/
//-- Grunt is a tool for Automating tasks

// Disable Deprecation Warnings
// (node:18670) [DEP0022] DeprecationWarning: os.tmpDir() is deprecated. Use os.tmpdir() instead.
let os = require("os");
os.tmpDir = os.tmpdir;

module.exports = function (grunt) {

  //-- Constants for the platformws
  const WIN32 = process.platform === "win32";
  const DARWIN = process.platform === "darwin";

  //-- Is this a WIP release (Work in Progress) or
  //-- a stable release?
  //-- WIP = True --> Work in progress
  //-- WIP = False --> Stable release
  const WIP = true;

  //-- Read the Package json and the timestamp
  let pkg = grunt.file.readJSON("app/package.json");
  let timestamp=grunt.template.today('yyyymmddhhmm');

  //-- In the Stables Releases there is NO timestamp
  if (!WIP) {
    timestamp = "";
  }

  //-- Write the timestamp information in the buildinfo.json
  //-- It will be read by icestudio to add the timestamp to the version
  grunt.file.write('app/buildinfo.json',JSON.stringify({ts:timestamp}));

  //-- Create the version
  //-- Stable releases: No timestamp
  //-- WIP: with timestamp
  pkg.version=pkg.version.replace(/w/,'w'+timestamp );
  
  //-- Tasks to perform. Common to ALL Platforms
  let distTasks = [

      //-- Validate js files: grunt-contrib-jshint
      //-- https://www.npmjs.com/package/grunt-contrib-jshint
      "jshint",  

      //-- Clean the temporary folders: grunt-contrib-clean
      //-- https://github.com/gruntjs/grunt-contrib-clean
      "clean:dist",
      
      //-- Extract/compile the English gettext strings: grunt-angular-gettext
      //-- https://www.npmjs.com/package/grunt-angular-gettext
      "nggettext_compile",

      //-- Replaces references from non-optimized scripts, stylesheets and
      //-- other assets to their optimized version within a set of HTML files
      //-- grunt-usemin
      //-- https://www.npmjs.com/package/grunt-usemin
      "useminPrepare",

      //-- Concatenate files: grunt-contrib-concat
      //-- https://github.com/gruntjs/grunt-contrib-concat
      //"concat",

      //-- Copy files and folders: grunt-contrib-copy
      //-- https://github.com/gruntjs/grunt-contrib-copy
      "copy:dist",

      //-- Minify JSON files in grunt: grunt-json-minification
      //-- https://www.npmjs.com/package/grunt-json-minification
      "json-minify",

      //-- grunt-contrib-uglify
      //-- Minify JavaScript files 
      "uglify",

      //-- Minify CSS
      //-- grunt-contrib-cssmin
      //-- https://github.com/gruntjs/grunt-contrib-cssmin
      //"cssmin",

      //-- Replaces references from non-optimized scripts, stylesheets and
      //-- other assets to their optimized version within a set of HTML files
      //-- grunt-usemin
      //-- https://www.npmjs.com/package/grunt-usemin
      "usemin",

      //-- TASK: Execute nw-build packaging
      "nwjs"
    ];

  //-- Variables to define what commands execute depending
  //-- on the platofm
  let platforms;  //-- Define the platform
  let options;    //-- Define options for that platform
  let distCommands;  //-- Define the commands needed for building the package

  //---------------------------------------------------------------
  //-- Configure the platform variables for the current system
  //--

  //-- MAC
  if (DARWIN) {
    platforms = ["osx64"];
    options = { scope: ["devDependencies", "darwinDependencies"] };
    distCommands = ["exec:repairOSX", "compress:osx64", "appdmg"];

  //-- Linux and Windows (64-bits)
  } else {

    platforms = ["linux64", "win64"];
    options = { scope: ["devDependencies"] };
    distCommands = [
      "compress:linux64",
      "appimage:linux64",
      "compress:win64",
      "wget:python64",
      "exec:nsis64"
    ];
  }

  //--- Building only for one platform
  //--- Set with the `platform` argument when calling grunt

  //--- Read if there is a platform argument set
  let onlyPlatform = grunt.option("platform") || "all";

  //-- Building only for Linux 64-bits
  if (onlyPlatform === "linux64") {
    distCommands = ["compress:linux64", "appimage:linux64"];
    platforms = ["linux64"];

    console.log("\n");
    console.log("---------------------------");
    console.log("| BUILDING ONLY LINUX 64  |");
    console.log("---------------------------");
    console.log("\n");
  }

  //-- Files to include in the Icestudio app
  let appFiles = [
    "index.html",      //-- app/index.html: Main HTML file
    "package.json",    //-- Package file
    all("resources"),  //-- Folder app/resources
    all("scripts"),    //-- JS files
    all("styles"),     //-- CSS files
    all("views"),      //-- HTML files
    all("fonts"),      //-- Fonts
    all("node_modules")
  ];

  function all(dir) {
    return dir + "/**/*.*";
  }
  
  //-- Load all grunt tasks
  require("load-grunt-tasks")(grunt, options);

  // Load custom tasks, from the tasks folder
  grunt.loadTasks("tasks");

  //-----------------------------------------------------------------------
  //  PROJECT CONFIGURATION
  //-----------------------------------------------------------------------
  grunt.initConfig({

    //-- Information about the package (read the package.json file)
    pkg: pkg,

    // Automatically inject Bower components into the app
    wiredep: {
      task: {
        directory: "app/bower_components",
        bowerJson: grunt.file.readJSON("app/bower.json"),
        src: ["index.html"]
      }
    },

    // Execute nw application
    exec: {
      nw: "nw app" + (WIN32 ? "" : " 2>/dev/null"),
      stopNW:
        (WIN32 ? "taskkill /F /IM nw.exe >NUL 2>&1" : "killall nw 2>/dev/null || killall nwjs 2>/dev/null") + " || (exit 0)",
      nsis64:
        'makensis -DARCH=win64 -DPYTHON="python-3.8.2-amd64.exe" -DVERSION=<%=pkg.version%> -V3 scripts/windows_installer.nsi',
      repairOSX: "scripts/repairOSX.sh"
    },

    // Reads HTML for usemin blocks to enable smart builds that automatically
    // concat, minify and revision files. Creates configurations in memory so
    // additional tasks can operate on them
    useminPrepare: {
      html: "app/index.html",
      options: {
        dest: "dist/tmp"
      }
    },

    //-- TASK: Copy
    // Copy dist files
    copy: {
      dist: {
        files: [
          {
            expand: true,
            cwd: "app",
            dest: "dist/tmp",
            src: [
              "index.html",
              "package.json",
              "buildinfo.json",
              "resources/**",
              "node_modules/**",
              "views/*.html"
            ]
          },
          {
            expand: true,
            cwd: "app/bower_components/bootstrap/fonts",
            dest: "dist/tmp/fonts",
            src: "*.*"
          }
        ]
      }
    },

    //-- TASK: json-minify
    // JSON minification plugin without concatination
    "json-minify": {
      json: {
        files: "dist/tmp/resources/**/*.json"
      },
      ice: {
        files: "dist/tmp/resources/**/*.ice"
      }
    },

    //-- TASK: uglify
    // Uglify configuration options:
    uglify: {
      options: {
        mangle: false
      }
    },

    // Rewrite based on filerev and the useminPrepare configuration
    usemin: {
      html: ["dist/tmp/index.html"]
    },

    //-- TASK: NWJS
    // Execute nw-build packaging
    nwjs: {
      options: {
        version: "0.35.5",
        //  flavor: 'normal', // For stable branch
        flavor: "sdk", // For development branch
        zip: false,
        buildDir: "dist/",
        winIco: "docs/resources/images/logo/icestudio-logo.ico",
        macIcns: "docs/resources/images/logo/nw.icns",
        macPlist: { CFBundleIconFile: "app" },
        platforms: platforms
      },
      src: ["dist/tmp/**"]
    },

    // Create standalone toolchains for each platform
    toolchain: {
      options: {
        apioMin: "<%=pkg.apio.min%>",
        apioMax: "<%=pkg.apio.max%>",
        buildDir: "dist/",
        extraPackages: "<%=pkg.apio.extras%>",
        platforms: platforms
      }
    },

    // ONLY MAC: generate a DMG package
    appdmg: {
      options: {
        basepath: ".",
        title: "Icestudio Installer",
        icon: "docs/resources/images/logo/icestudio-logo.icns",
        background:
          "docs/resources/images/installation/installer-background.png",
        window: {
          size: {
            width: 512,
            height: 385
          }
        },
        contents: [
          {
            x: 345,
            y: 250,
            type: "link",
            path: "/Applications"
          },
          {
            x: 170,
            y: 250,
            type: "file",
            path: "dist/icestudio/osx64/icestudio.app"
          }
        ]
      },
      target: {
        dest: "dist/<%=pkg.name%>-<%=pkg.version%>-osx64.dmg"
      }
    },

    // ONLY LINUX: generate AppImage packages
    appimage: {
      linux64: {
        options: {
          name: "Icestudio",
          exec: "icestudio",
          arch: "64bit",
          icons: "docs/resources/icons",
          comment: "Visual editor for open FPGA boards",
          archive: "dist/<%=pkg.name%>-<%=pkg.version%>-linux64.AppImage"
        },
        files: [
          {
            expand: true,
            cwd: "dist/icestudio/linux64/",
            src: ["**"].concat(appFiles)
          }
        ]
      }
    },

    // Compress packages using zip
    compress: {
      linux64: {
        options: {
          archive: "dist/<%=pkg.name%>-<%=pkg.version%>-linux64.zip"
        },
        files: [
          {
            expand: true,
            cwd: "dist/icestudio/linux64/",
            src: ["**"].concat(appFiles),
            dest: "<%=pkg.name%>-<%=pkg.version%>-linux64"
          }
        ]
      },
      win64: {
        options: {
          archive: "dist/<%=pkg.name%>-<%=pkg.version%>-win64.zip"
        },
        files: [
          {
            expand: true,
            cwd: "dist/icestudio/win64/",
            src: ["**"].concat(appFiles),
            dest: "<%=pkg.name%>-<%=pkg.version%>-win64"
          }
        ]
      },
      osx64: {
        options: {
          archive: "dist/<%=pkg.name%>-<%=pkg.version%>-osx64.zip"
        },
        files: [
          {
            expand: true,
            cwd: "dist/icestudio/osx64/",
            src: ["icestudio.app/**"],
            dest: "<%=pkg.name%>-<%=pkg.version%>-osx64"
          }
        ]
      }
    },

    // Watch files for changes and runs tasks based on the changed files
    watch: {
      scripts: {
        files: [
          "app/resources/boards/**/*.*",
          "app/resources/fonts/**/*.*",
          "app/resources/images/**/*.*",
          "app/resources/locale/**/*.*",
          "app/resources/uiThemes/**/*.*",
          "app/resources/viewers/**/*.*",
          "app/scripts/**/*.*",
          "app/styles/**/*.*",
          "app/views/**/*.*"
        ],
        tasks: ["wiredep", "exec:stopNW", "exec:nw"],
        options: {
          atBegin: true,
          interrupt: true
        }
      }
    },

    //-- TASK: jshint
    // Check all js files
    jshint: {

      //-- This are the js files to check
      all: ["app/scripts/**/*.js", "tasks/*.js", "gruntfile.js"],
      options: {

        //-- jshint configuration file
        jshintrc: ".jshintrc",
        esversion: 6
      }
    },

    // Wget: Python installer and Default collection
    wget: {
      python64: {
        options: {
          overwrite: false
        },
        src: "https://www.python.org/ftp/python/3.8.2/python-3.8.2-amd64.exe",
        dest: "cache/python/python-3.8.2-amd64.exe"
      },
      collection: {
        options: {
          overwrite: false
        },
        src:
          "https://github.com/FPGAwars/collection-default/archive/v<%=pkg.collection%>.zip",
        dest: "cache/collection/collection-default-v<%=pkg.collection%>.zip"
      }
    },

    // Unzip Default collection
    unzip: {
      "using-router": {
        router: function (filepath) {
          return filepath.replace(/^collection-default-.*?\//g, "collection/");
        },
        src: "cache/collection/collection-default-v<%=pkg.collection%>.zip",
        dest: "app/resources/"
      }
    },

    // TASK: Clean
    // Empty folders to start fresh
    clean: {
      tmp: [".tmp", "dist/tmp"],
      dist: ["dist"],
      toolchain: [
        "cache/toolchain/default-python-packages",
        "cache/toolchain/default-apio",
        "cache/toolchain/*.zip"
      ],
      collection: ["app/resources/collection"]
    },

    // Generate POT file
    nggettext_extract: {
      pot: {
        files: {
          "app/resources/locale/template.pot": [
            "app/views/*.html",
            "app/scripts/**/*.js"
          ]
        }
      }
    },

    //-- TASK: nggettext_compile
    // Compile PO files into JSON
    nggettext_compile: {
      all: {
        options: {
          format: "json"
        },
        files: [
          {
            expand: true,
            cwd: "app/resources/locale",
            dest: "app/resources/locale",
            src: ["**/*.po"],
            ext: ".json"
          },
          {
            expand: true,
            cwd: "app/resources/collection/locale",
            dest: "app/resources/collection/locale",
            src: ["**/*.po"],
            ext: ".json"
          }
        ]
      }
    }
  });

  //------------------------------------------------------------------
  //-- PROJECT CONFIGURATION: END
  //---------------------------------------------------------------------

  // Default task
  grunt.registerTask("default", function () {
    console.log("Icestudio");
  });

  //-- Task: gettext
  grunt.registerTask("gettext", ["nggettext_extract"]);

  //-- Task: compiletext
  grunt.registerTask("compiletext", ["nggettext_compile"]);

  //-- Task: getcollection
  grunt.registerTask("getcollection", [
    "clean:collection",
    "wget:collection",
    "unzip"
  ]);

  //-- Task: Serve (run the app)
  grunt.registerTask("serve", ["nggettext_compile", "watch:scripts"]);

  //-- Task: dist: Create the app package
  grunt.registerTask(
    "dist",
    distTasks.concat(distCommands).concat(["clean:tmp"])
  );
  
};


