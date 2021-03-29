var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __commonJS = (callback, module2) => () => {
  if (!module2) {
    module2 = {exports: {}};
    callback(module2.exports, module2);
  }
  return module2.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
var __exportStar = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  return __exportStar(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? {get: () => module2.default, enumerable: true} : {value: module2, enumerable: true})), module2);
};

// node_modules/vscode-languageclient/node_modules/semver/semver.js
var require_semver = __commonJS((exports2, module2) => {
  exports2 = module2.exports = SemVer;
  var debug2;
  if (typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG)) {
    debug2 = function() {
      var args = Array.prototype.slice.call(arguments, 0);
      args.unshift("SEMVER");
      console.log.apply(console, args);
    };
  } else {
    debug2 = function() {
    };
  }
  exports2.SEMVER_SPEC_VERSION = "2.0.0";
  var MAX_LENGTH = 256;
  var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
  var MAX_SAFE_COMPONENT_LENGTH = 16;
  var re = exports2.re = [];
  var src = exports2.src = [];
  var t = exports2.tokens = {};
  var R = 0;
  function tok(n) {
    t[n] = R++;
  }
  tok("NUMERICIDENTIFIER");
  src[t.NUMERICIDENTIFIER] = "0|[1-9]\\d*";
  tok("NUMERICIDENTIFIERLOOSE");
  src[t.NUMERICIDENTIFIERLOOSE] = "[0-9]+";
  tok("NONNUMERICIDENTIFIER");
  src[t.NONNUMERICIDENTIFIER] = "\\d*[a-zA-Z-][a-zA-Z0-9-]*";
  tok("MAINVERSION");
  src[t.MAINVERSION] = "(" + src[t.NUMERICIDENTIFIER] + ")\\.(" + src[t.NUMERICIDENTIFIER] + ")\\.(" + src[t.NUMERICIDENTIFIER] + ")";
  tok("MAINVERSIONLOOSE");
  src[t.MAINVERSIONLOOSE] = "(" + src[t.NUMERICIDENTIFIERLOOSE] + ")\\.(" + src[t.NUMERICIDENTIFIERLOOSE] + ")\\.(" + src[t.NUMERICIDENTIFIERLOOSE] + ")";
  tok("PRERELEASEIDENTIFIER");
  src[t.PRERELEASEIDENTIFIER] = "(?:" + src[t.NUMERICIDENTIFIER] + "|" + src[t.NONNUMERICIDENTIFIER] + ")";
  tok("PRERELEASEIDENTIFIERLOOSE");
  src[t.PRERELEASEIDENTIFIERLOOSE] = "(?:" + src[t.NUMERICIDENTIFIERLOOSE] + "|" + src[t.NONNUMERICIDENTIFIER] + ")";
  tok("PRERELEASE");
  src[t.PRERELEASE] = "(?:-(" + src[t.PRERELEASEIDENTIFIER] + "(?:\\." + src[t.PRERELEASEIDENTIFIER] + ")*))";
  tok("PRERELEASELOOSE");
  src[t.PRERELEASELOOSE] = "(?:-?(" + src[t.PRERELEASEIDENTIFIERLOOSE] + "(?:\\." + src[t.PRERELEASEIDENTIFIERLOOSE] + ")*))";
  tok("BUILDIDENTIFIER");
  src[t.BUILDIDENTIFIER] = "[0-9A-Za-z-]+";
  tok("BUILD");
  src[t.BUILD] = "(?:\\+(" + src[t.BUILDIDENTIFIER] + "(?:\\." + src[t.BUILDIDENTIFIER] + ")*))";
  tok("FULL");
  tok("FULLPLAIN");
  src[t.FULLPLAIN] = "v?" + src[t.MAINVERSION] + src[t.PRERELEASE] + "?" + src[t.BUILD] + "?";
  src[t.FULL] = "^" + src[t.FULLPLAIN] + "$";
  tok("LOOSEPLAIN");
  src[t.LOOSEPLAIN] = "[v=\\s]*" + src[t.MAINVERSIONLOOSE] + src[t.PRERELEASELOOSE] + "?" + src[t.BUILD] + "?";
  tok("LOOSE");
  src[t.LOOSE] = "^" + src[t.LOOSEPLAIN] + "$";
  tok("GTLT");
  src[t.GTLT] = "((?:<|>)?=?)";
  tok("XRANGEIDENTIFIERLOOSE");
  src[t.XRANGEIDENTIFIERLOOSE] = src[t.NUMERICIDENTIFIERLOOSE] + "|x|X|\\*";
  tok("XRANGEIDENTIFIER");
  src[t.XRANGEIDENTIFIER] = src[t.NUMERICIDENTIFIER] + "|x|X|\\*";
  tok("XRANGEPLAIN");
  src[t.XRANGEPLAIN] = "[v=\\s]*(" + src[t.XRANGEIDENTIFIER] + ")(?:\\.(" + src[t.XRANGEIDENTIFIER] + ")(?:\\.(" + src[t.XRANGEIDENTIFIER] + ")(?:" + src[t.PRERELEASE] + ")?" + src[t.BUILD] + "?)?)?";
  tok("XRANGEPLAINLOOSE");
  src[t.XRANGEPLAINLOOSE] = "[v=\\s]*(" + src[t.XRANGEIDENTIFIERLOOSE] + ")(?:\\.(" + src[t.XRANGEIDENTIFIERLOOSE] + ")(?:\\.(" + src[t.XRANGEIDENTIFIERLOOSE] + ")(?:" + src[t.PRERELEASELOOSE] + ")?" + src[t.BUILD] + "?)?)?";
  tok("XRANGE");
  src[t.XRANGE] = "^" + src[t.GTLT] + "\\s*" + src[t.XRANGEPLAIN] + "$";
  tok("XRANGELOOSE");
  src[t.XRANGELOOSE] = "^" + src[t.GTLT] + "\\s*" + src[t.XRANGEPLAINLOOSE] + "$";
  tok("COERCE");
  src[t.COERCE] = "(^|[^\\d])(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "})(?:\\.(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "}))?(?:\\.(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "}))?(?:$|[^\\d])";
  tok("COERCERTL");
  re[t.COERCERTL] = new RegExp(src[t.COERCE], "g");
  tok("LONETILDE");
  src[t.LONETILDE] = "(?:~>?)";
  tok("TILDETRIM");
  src[t.TILDETRIM] = "(\\s*)" + src[t.LONETILDE] + "\\s+";
  re[t.TILDETRIM] = new RegExp(src[t.TILDETRIM], "g");
  var tildeTrimReplace = "$1~";
  tok("TILDE");
  src[t.TILDE] = "^" + src[t.LONETILDE] + src[t.XRANGEPLAIN] + "$";
  tok("TILDELOOSE");
  src[t.TILDELOOSE] = "^" + src[t.LONETILDE] + src[t.XRANGEPLAINLOOSE] + "$";
  tok("LONECARET");
  src[t.LONECARET] = "(?:\\^)";
  tok("CARETTRIM");
  src[t.CARETTRIM] = "(\\s*)" + src[t.LONECARET] + "\\s+";
  re[t.CARETTRIM] = new RegExp(src[t.CARETTRIM], "g");
  var caretTrimReplace = "$1^";
  tok("CARET");
  src[t.CARET] = "^" + src[t.LONECARET] + src[t.XRANGEPLAIN] + "$";
  tok("CARETLOOSE");
  src[t.CARETLOOSE] = "^" + src[t.LONECARET] + src[t.XRANGEPLAINLOOSE] + "$";
  tok("COMPARATORLOOSE");
  src[t.COMPARATORLOOSE] = "^" + src[t.GTLT] + "\\s*(" + src[t.LOOSEPLAIN] + ")$|^$";
  tok("COMPARATOR");
  src[t.COMPARATOR] = "^" + src[t.GTLT] + "\\s*(" + src[t.FULLPLAIN] + ")$|^$";
  tok("COMPARATORTRIM");
  src[t.COMPARATORTRIM] = "(\\s*)" + src[t.GTLT] + "\\s*(" + src[t.LOOSEPLAIN] + "|" + src[t.XRANGEPLAIN] + ")";
  re[t.COMPARATORTRIM] = new RegExp(src[t.COMPARATORTRIM], "g");
  var comparatorTrimReplace = "$1$2$3";
  tok("HYPHENRANGE");
  src[t.HYPHENRANGE] = "^\\s*(" + src[t.XRANGEPLAIN] + ")\\s+-\\s+(" + src[t.XRANGEPLAIN] + ")\\s*$";
  tok("HYPHENRANGELOOSE");
  src[t.HYPHENRANGELOOSE] = "^\\s*(" + src[t.XRANGEPLAINLOOSE] + ")\\s+-\\s+(" + src[t.XRANGEPLAINLOOSE] + ")\\s*$";
  tok("STAR");
  src[t.STAR] = "(<|>)?=?\\s*\\*";
  for (var i = 0; i < R; i++) {
    debug2(i, src[i]);
    if (!re[i]) {
      re[i] = new RegExp(src[i]);
    }
  }
  exports2.parse = parse;
  function parse(version, options) {
    if (!options || typeof options !== "object") {
      options = {
        loose: !!options,
        includePrerelease: false
      };
    }
    if (version instanceof SemVer) {
      return version;
    }
    if (typeof version !== "string") {
      return null;
    }
    if (version.length > MAX_LENGTH) {
      return null;
    }
    var r = options.loose ? re[t.LOOSE] : re[t.FULL];
    if (!r.test(version)) {
      return null;
    }
    try {
      return new SemVer(version, options);
    } catch (er) {
      return null;
    }
  }
  exports2.valid = valid;
  function valid(version, options) {
    var v = parse(version, options);
    return v ? v.version : null;
  }
  exports2.clean = clean;
  function clean(version, options) {
    var s = parse(version.trim().replace(/^[=v]+/, ""), options);
    return s ? s.version : null;
  }
  exports2.SemVer = SemVer;
  function SemVer(version, options) {
    if (!options || typeof options !== "object") {
      options = {
        loose: !!options,
        includePrerelease: false
      };
    }
    if (version instanceof SemVer) {
      if (version.loose === options.loose) {
        return version;
      } else {
        version = version.version;
      }
    } else if (typeof version !== "string") {
      throw new TypeError("Invalid Version: " + version);
    }
    if (version.length > MAX_LENGTH) {
      throw new TypeError("version is longer than " + MAX_LENGTH + " characters");
    }
    if (!(this instanceof SemVer)) {
      return new SemVer(version, options);
    }
    debug2("SemVer", version, options);
    this.options = options;
    this.loose = !!options.loose;
    var m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
    if (!m) {
      throw new TypeError("Invalid Version: " + version);
    }
    this.raw = version;
    this.major = +m[1];
    this.minor = +m[2];
    this.patch = +m[3];
    if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
      throw new TypeError("Invalid major version");
    }
    if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
      throw new TypeError("Invalid minor version");
    }
    if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
      throw new TypeError("Invalid patch version");
    }
    if (!m[4]) {
      this.prerelease = [];
    } else {
      this.prerelease = m[4].split(".").map(function(id) {
        if (/^[0-9]+$/.test(id)) {
          var num = +id;
          if (num >= 0 && num < MAX_SAFE_INTEGER) {
            return num;
          }
        }
        return id;
      });
    }
    this.build = m[5] ? m[5].split(".") : [];
    this.format();
  }
  SemVer.prototype.format = function() {
    this.version = this.major + "." + this.minor + "." + this.patch;
    if (this.prerelease.length) {
      this.version += "-" + this.prerelease.join(".");
    }
    return this.version;
  };
  SemVer.prototype.toString = function() {
    return this.version;
  };
  SemVer.prototype.compare = function(other) {
    debug2("SemVer.compare", this.version, this.options, other);
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }
    return this.compareMain(other) || this.comparePre(other);
  };
  SemVer.prototype.compareMain = function(other) {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }
    return compareIdentifiers(this.major, other.major) || compareIdentifiers(this.minor, other.minor) || compareIdentifiers(this.patch, other.patch);
  };
  SemVer.prototype.comparePre = function(other) {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }
    if (this.prerelease.length && !other.prerelease.length) {
      return -1;
    } else if (!this.prerelease.length && other.prerelease.length) {
      return 1;
    } else if (!this.prerelease.length && !other.prerelease.length) {
      return 0;
    }
    var i2 = 0;
    do {
      var a = this.prerelease[i2];
      var b = other.prerelease[i2];
      debug2("prerelease compare", i2, a, b);
      if (a === void 0 && b === void 0) {
        return 0;
      } else if (b === void 0) {
        return 1;
      } else if (a === void 0) {
        return -1;
      } else if (a === b) {
        continue;
      } else {
        return compareIdentifiers(a, b);
      }
    } while (++i2);
  };
  SemVer.prototype.compareBuild = function(other) {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }
    var i2 = 0;
    do {
      var a = this.build[i2];
      var b = other.build[i2];
      debug2("prerelease compare", i2, a, b);
      if (a === void 0 && b === void 0) {
        return 0;
      } else if (b === void 0) {
        return 1;
      } else if (a === void 0) {
        return -1;
      } else if (a === b) {
        continue;
      } else {
        return compareIdentifiers(a, b);
      }
    } while (++i2);
  };
  SemVer.prototype.inc = function(release, identifier) {
    switch (release) {
      case "premajor":
        this.prerelease.length = 0;
        this.patch = 0;
        this.minor = 0;
        this.major++;
        this.inc("pre", identifier);
        break;
      case "preminor":
        this.prerelease.length = 0;
        this.patch = 0;
        this.minor++;
        this.inc("pre", identifier);
        break;
      case "prepatch":
        this.prerelease.length = 0;
        this.inc("patch", identifier);
        this.inc("pre", identifier);
        break;
      case "prerelease":
        if (this.prerelease.length === 0) {
          this.inc("patch", identifier);
        }
        this.inc("pre", identifier);
        break;
      case "major":
        if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
          this.major++;
        }
        this.minor = 0;
        this.patch = 0;
        this.prerelease = [];
        break;
      case "minor":
        if (this.patch !== 0 || this.prerelease.length === 0) {
          this.minor++;
        }
        this.patch = 0;
        this.prerelease = [];
        break;
      case "patch":
        if (this.prerelease.length === 0) {
          this.patch++;
        }
        this.prerelease = [];
        break;
      case "pre":
        if (this.prerelease.length === 0) {
          this.prerelease = [0];
        } else {
          var i2 = this.prerelease.length;
          while (--i2 >= 0) {
            if (typeof this.prerelease[i2] === "number") {
              this.prerelease[i2]++;
              i2 = -2;
            }
          }
          if (i2 === -1) {
            this.prerelease.push(0);
          }
        }
        if (identifier) {
          if (this.prerelease[0] === identifier) {
            if (isNaN(this.prerelease[1])) {
              this.prerelease = [identifier, 0];
            }
          } else {
            this.prerelease = [identifier, 0];
          }
        }
        break;
      default:
        throw new Error("invalid increment argument: " + release);
    }
    this.format();
    this.raw = this.version;
    return this;
  };
  exports2.inc = inc;
  function inc(version, release, loose, identifier) {
    if (typeof loose === "string") {
      identifier = loose;
      loose = void 0;
    }
    try {
      return new SemVer(version, loose).inc(release, identifier).version;
    } catch (er) {
      return null;
    }
  }
  exports2.diff = diff;
  function diff(version1, version2) {
    if (eq(version1, version2)) {
      return null;
    } else {
      var v1 = parse(version1);
      var v2 = parse(version2);
      var prefix = "";
      if (v1.prerelease.length || v2.prerelease.length) {
        prefix = "pre";
        var defaultResult = "prerelease";
      }
      for (var key in v1) {
        if (key === "major" || key === "minor" || key === "patch") {
          if (v1[key] !== v2[key]) {
            return prefix + key;
          }
        }
      }
      return defaultResult;
    }
  }
  exports2.compareIdentifiers = compareIdentifiers;
  var numeric = /^[0-9]+$/;
  function compareIdentifiers(a, b) {
    var anum = numeric.test(a);
    var bnum = numeric.test(b);
    if (anum && bnum) {
      a = +a;
      b = +b;
    }
    return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
  }
  exports2.rcompareIdentifiers = rcompareIdentifiers;
  function rcompareIdentifiers(a, b) {
    return compareIdentifiers(b, a);
  }
  exports2.major = major;
  function major(a, loose) {
    return new SemVer(a, loose).major;
  }
  exports2.minor = minor;
  function minor(a, loose) {
    return new SemVer(a, loose).minor;
  }
  exports2.patch = patch;
  function patch(a, loose) {
    return new SemVer(a, loose).patch;
  }
  exports2.compare = compare;
  function compare(a, b, loose) {
    return new SemVer(a, loose).compare(new SemVer(b, loose));
  }
  exports2.compareLoose = compareLoose;
  function compareLoose(a, b) {
    return compare(a, b, true);
  }
  exports2.compareBuild = compareBuild;
  function compareBuild(a, b, loose) {
    var versionA = new SemVer(a, loose);
    var versionB = new SemVer(b, loose);
    return versionA.compare(versionB) || versionA.compareBuild(versionB);
  }
  exports2.rcompare = rcompare;
  function rcompare(a, b, loose) {
    return compare(b, a, loose);
  }
  exports2.sort = sort;
  function sort(list, loose) {
    return list.sort(function(a, b) {
      return exports2.compareBuild(a, b, loose);
    });
  }
  exports2.rsort = rsort;
  function rsort(list, loose) {
    return list.sort(function(a, b) {
      return exports2.compareBuild(b, a, loose);
    });
  }
  exports2.gt = gt;
  function gt(a, b, loose) {
    return compare(a, b, loose) > 0;
  }
  exports2.lt = lt;
  function lt(a, b, loose) {
    return compare(a, b, loose) < 0;
  }
  exports2.eq = eq;
  function eq(a, b, loose) {
    return compare(a, b, loose) === 0;
  }
  exports2.neq = neq;
  function neq(a, b, loose) {
    return compare(a, b, loose) !== 0;
  }
  exports2.gte = gte;
  function gte(a, b, loose) {
    return compare(a, b, loose) >= 0;
  }
  exports2.lte = lte;
  function lte(a, b, loose) {
    return compare(a, b, loose) <= 0;
  }
  exports2.cmp = cmp;
  function cmp(a, op, b, loose) {
    switch (op) {
      case "===":
        if (typeof a === "object")
          a = a.version;
        if (typeof b === "object")
          b = b.version;
        return a === b;
      case "!==":
        if (typeof a === "object")
          a = a.version;
        if (typeof b === "object")
          b = b.version;
        return a !== b;
      case "":
      case "=":
      case "==":
        return eq(a, b, loose);
      case "!=":
        return neq(a, b, loose);
      case ">":
        return gt(a, b, loose);
      case ">=":
        return gte(a, b, loose);
      case "<":
        return lt(a, b, loose);
      case "<=":
        return lte(a, b, loose);
      default:
        throw new TypeError("Invalid operator: " + op);
    }
  }
  exports2.Comparator = Comparator;
  function Comparator(comp, options) {
    if (!options || typeof options !== "object") {
      options = {
        loose: !!options,
        includePrerelease: false
      };
    }
    if (comp instanceof Comparator) {
      if (comp.loose === !!options.loose) {
        return comp;
      } else {
        comp = comp.value;
      }
    }
    if (!(this instanceof Comparator)) {
      return new Comparator(comp, options);
    }
    debug2("comparator", comp, options);
    this.options = options;
    this.loose = !!options.loose;
    this.parse(comp);
    if (this.semver === ANY) {
      this.value = "";
    } else {
      this.value = this.operator + this.semver.version;
    }
    debug2("comp", this);
  }
  var ANY = {};
  Comparator.prototype.parse = function(comp) {
    var r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
    var m = comp.match(r);
    if (!m) {
      throw new TypeError("Invalid comparator: " + comp);
    }
    this.operator = m[1] !== void 0 ? m[1] : "";
    if (this.operator === "=") {
      this.operator = "";
    }
    if (!m[2]) {
      this.semver = ANY;
    } else {
      this.semver = new SemVer(m[2], this.options.loose);
    }
  };
  Comparator.prototype.toString = function() {
    return this.value;
  };
  Comparator.prototype.test = function(version) {
    debug2("Comparator.test", version, this.options.loose);
    if (this.semver === ANY || version === ANY) {
      return true;
    }
    if (typeof version === "string") {
      try {
        version = new SemVer(version, this.options);
      } catch (er) {
        return false;
      }
    }
    return cmp(version, this.operator, this.semver, this.options);
  };
  Comparator.prototype.intersects = function(comp, options) {
    if (!(comp instanceof Comparator)) {
      throw new TypeError("a Comparator is required");
    }
    if (!options || typeof options !== "object") {
      options = {
        loose: !!options,
        includePrerelease: false
      };
    }
    var rangeTmp;
    if (this.operator === "") {
      if (this.value === "") {
        return true;
      }
      rangeTmp = new Range(comp.value, options);
      return satisfies(this.value, rangeTmp, options);
    } else if (comp.operator === "") {
      if (comp.value === "") {
        return true;
      }
      rangeTmp = new Range(this.value, options);
      return satisfies(comp.semver, rangeTmp, options);
    }
    var sameDirectionIncreasing = (this.operator === ">=" || this.operator === ">") && (comp.operator === ">=" || comp.operator === ">");
    var sameDirectionDecreasing = (this.operator === "<=" || this.operator === "<") && (comp.operator === "<=" || comp.operator === "<");
    var sameSemVer = this.semver.version === comp.semver.version;
    var differentDirectionsInclusive = (this.operator === ">=" || this.operator === "<=") && (comp.operator === ">=" || comp.operator === "<=");
    var oppositeDirectionsLessThan = cmp(this.semver, "<", comp.semver, options) && ((this.operator === ">=" || this.operator === ">") && (comp.operator === "<=" || comp.operator === "<"));
    var oppositeDirectionsGreaterThan = cmp(this.semver, ">", comp.semver, options) && ((this.operator === "<=" || this.operator === "<") && (comp.operator === ">=" || comp.operator === ">"));
    return sameDirectionIncreasing || sameDirectionDecreasing || sameSemVer && differentDirectionsInclusive || oppositeDirectionsLessThan || oppositeDirectionsGreaterThan;
  };
  exports2.Range = Range;
  function Range(range, options) {
    if (!options || typeof options !== "object") {
      options = {
        loose: !!options,
        includePrerelease: false
      };
    }
    if (range instanceof Range) {
      if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
        return range;
      } else {
        return new Range(range.raw, options);
      }
    }
    if (range instanceof Comparator) {
      return new Range(range.value, options);
    }
    if (!(this instanceof Range)) {
      return new Range(range, options);
    }
    this.options = options;
    this.loose = !!options.loose;
    this.includePrerelease = !!options.includePrerelease;
    this.raw = range;
    this.set = range.split(/\s*\|\|\s*/).map(function(range2) {
      return this.parseRange(range2.trim());
    }, this).filter(function(c) {
      return c.length;
    });
    if (!this.set.length) {
      throw new TypeError("Invalid SemVer Range: " + range);
    }
    this.format();
  }
  Range.prototype.format = function() {
    this.range = this.set.map(function(comps) {
      return comps.join(" ").trim();
    }).join("||").trim();
    return this.range;
  };
  Range.prototype.toString = function() {
    return this.range;
  };
  Range.prototype.parseRange = function(range) {
    var loose = this.options.loose;
    range = range.trim();
    var hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
    range = range.replace(hr, hyphenReplace);
    debug2("hyphen replace", range);
    range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
    debug2("comparator trim", range, re[t.COMPARATORTRIM]);
    range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
    range = range.replace(re[t.CARETTRIM], caretTrimReplace);
    range = range.split(/\s+/).join(" ");
    var compRe = loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
    var set = range.split(" ").map(function(comp) {
      return parseComparator(comp, this.options);
    }, this).join(" ").split(/\s+/);
    if (this.options.loose) {
      set = set.filter(function(comp) {
        return !!comp.match(compRe);
      });
    }
    set = set.map(function(comp) {
      return new Comparator(comp, this.options);
    }, this);
    return set;
  };
  Range.prototype.intersects = function(range, options) {
    if (!(range instanceof Range)) {
      throw new TypeError("a Range is required");
    }
    return this.set.some(function(thisComparators) {
      return isSatisfiable(thisComparators, options) && range.set.some(function(rangeComparators) {
        return isSatisfiable(rangeComparators, options) && thisComparators.every(function(thisComparator) {
          return rangeComparators.every(function(rangeComparator) {
            return thisComparator.intersects(rangeComparator, options);
          });
        });
      });
    });
  };
  function isSatisfiable(comparators, options) {
    var result = true;
    var remainingComparators = comparators.slice();
    var testComparator = remainingComparators.pop();
    while (result && remainingComparators.length) {
      result = remainingComparators.every(function(otherComparator) {
        return testComparator.intersects(otherComparator, options);
      });
      testComparator = remainingComparators.pop();
    }
    return result;
  }
  exports2.toComparators = toComparators;
  function toComparators(range, options) {
    return new Range(range, options).set.map(function(comp) {
      return comp.map(function(c) {
        return c.value;
      }).join(" ").trim().split(" ");
    });
  }
  function parseComparator(comp, options) {
    debug2("comp", comp, options);
    comp = replaceCarets(comp, options);
    debug2("caret", comp);
    comp = replaceTildes(comp, options);
    debug2("tildes", comp);
    comp = replaceXRanges(comp, options);
    debug2("xrange", comp);
    comp = replaceStars(comp, options);
    debug2("stars", comp);
    return comp;
  }
  function isX(id) {
    return !id || id.toLowerCase() === "x" || id === "*";
  }
  function replaceTildes(comp, options) {
    return comp.trim().split(/\s+/).map(function(comp2) {
      return replaceTilde(comp2, options);
    }).join(" ");
  }
  function replaceTilde(comp, options) {
    var r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
    return comp.replace(r, function(_, M, m, p, pr) {
      debug2("tilde", comp, _, M, m, p, pr);
      var ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
      } else if (isX(p)) {
        ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
      } else if (pr) {
        debug2("replaceTilde pr", pr);
        ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + (+m + 1) + ".0";
      } else {
        ret = ">=" + M + "." + m + "." + p + " <" + M + "." + (+m + 1) + ".0";
      }
      debug2("tilde return", ret);
      return ret;
    });
  }
  function replaceCarets(comp, options) {
    return comp.trim().split(/\s+/).map(function(comp2) {
      return replaceCaret(comp2, options);
    }).join(" ");
  }
  function replaceCaret(comp, options) {
    debug2("caret", comp, options);
    var r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
    return comp.replace(r, function(_, M, m, p, pr) {
      debug2("caret", comp, _, M, m, p, pr);
      var ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
      } else if (isX(p)) {
        if (M === "0") {
          ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
        } else {
          ret = ">=" + M + "." + m + ".0 <" + (+M + 1) + ".0.0";
        }
      } else if (pr) {
        debug2("replaceCaret pr", pr);
        if (M === "0") {
          if (m === "0") {
            ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + m + "." + (+p + 1);
          } else {
            ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + (+m + 1) + ".0";
          }
        } else {
          ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + (+M + 1) + ".0.0";
        }
      } else {
        debug2("no pr");
        if (M === "0") {
          if (m === "0") {
            ret = ">=" + M + "." + m + "." + p + " <" + M + "." + m + "." + (+p + 1);
          } else {
            ret = ">=" + M + "." + m + "." + p + " <" + M + "." + (+m + 1) + ".0";
          }
        } else {
          ret = ">=" + M + "." + m + "." + p + " <" + (+M + 1) + ".0.0";
        }
      }
      debug2("caret return", ret);
      return ret;
    });
  }
  function replaceXRanges(comp, options) {
    debug2("replaceXRanges", comp, options);
    return comp.split(/\s+/).map(function(comp2) {
      return replaceXRange(comp2, options);
    }).join(" ");
  }
  function replaceXRange(comp, options) {
    comp = comp.trim();
    var r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
    return comp.replace(r, function(ret, gtlt, M, m, p, pr) {
      debug2("xRange", comp, ret, gtlt, M, m, p, pr);
      var xM = isX(M);
      var xm = xM || isX(m);
      var xp = xm || isX(p);
      var anyX = xp;
      if (gtlt === "=" && anyX) {
        gtlt = "";
      }
      pr = options.includePrerelease ? "-0" : "";
      if (xM) {
        if (gtlt === ">" || gtlt === "<") {
          ret = "<0.0.0-0";
        } else {
          ret = "*";
        }
      } else if (gtlt && anyX) {
        if (xm) {
          m = 0;
        }
        p = 0;
        if (gtlt === ">") {
          gtlt = ">=";
          if (xm) {
            M = +M + 1;
            m = 0;
            p = 0;
          } else {
            m = +m + 1;
            p = 0;
          }
        } else if (gtlt === "<=") {
          gtlt = "<";
          if (xm) {
            M = +M + 1;
          } else {
            m = +m + 1;
          }
        }
        ret = gtlt + M + "." + m + "." + p + pr;
      } else if (xm) {
        ret = ">=" + M + ".0.0" + pr + " <" + (+M + 1) + ".0.0" + pr;
      } else if (xp) {
        ret = ">=" + M + "." + m + ".0" + pr + " <" + M + "." + (+m + 1) + ".0" + pr;
      }
      debug2("xRange return", ret);
      return ret;
    });
  }
  function replaceStars(comp, options) {
    debug2("replaceStars", comp, options);
    return comp.trim().replace(re[t.STAR], "");
  }
  function hyphenReplace($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr, tb) {
    if (isX(fM)) {
      from = "";
    } else if (isX(fm)) {
      from = ">=" + fM + ".0.0";
    } else if (isX(fp)) {
      from = ">=" + fM + "." + fm + ".0";
    } else {
      from = ">=" + from;
    }
    if (isX(tM)) {
      to = "";
    } else if (isX(tm)) {
      to = "<" + (+tM + 1) + ".0.0";
    } else if (isX(tp)) {
      to = "<" + tM + "." + (+tm + 1) + ".0";
    } else if (tpr) {
      to = "<=" + tM + "." + tm + "." + tp + "-" + tpr;
    } else {
      to = "<=" + to;
    }
    return (from + " " + to).trim();
  }
  Range.prototype.test = function(version) {
    if (!version) {
      return false;
    }
    if (typeof version === "string") {
      try {
        version = new SemVer(version, this.options);
      } catch (er) {
        return false;
      }
    }
    for (var i2 = 0; i2 < this.set.length; i2++) {
      if (testSet(this.set[i2], version, this.options)) {
        return true;
      }
    }
    return false;
  };
  function testSet(set, version, options) {
    for (var i2 = 0; i2 < set.length; i2++) {
      if (!set[i2].test(version)) {
        return false;
      }
    }
    if (version.prerelease.length && !options.includePrerelease) {
      for (i2 = 0; i2 < set.length; i2++) {
        debug2(set[i2].semver);
        if (set[i2].semver === ANY) {
          continue;
        }
        if (set[i2].semver.prerelease.length > 0) {
          var allowed = set[i2].semver;
          if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
            return true;
          }
        }
      }
      return false;
    }
    return true;
  }
  exports2.satisfies = satisfies;
  function satisfies(version, range, options) {
    try {
      range = new Range(range, options);
    } catch (er) {
      return false;
    }
    return range.test(version);
  }
  exports2.maxSatisfying = maxSatisfying;
  function maxSatisfying(versions, range, options) {
    var max = null;
    var maxSV = null;
    try {
      var rangeObj = new Range(range, options);
    } catch (er) {
      return null;
    }
    versions.forEach(function(v) {
      if (rangeObj.test(v)) {
        if (!max || maxSV.compare(v) === -1) {
          max = v;
          maxSV = new SemVer(max, options);
        }
      }
    });
    return max;
  }
  exports2.minSatisfying = minSatisfying;
  function minSatisfying(versions, range, options) {
    var min = null;
    var minSV = null;
    try {
      var rangeObj = new Range(range, options);
    } catch (er) {
      return null;
    }
    versions.forEach(function(v) {
      if (rangeObj.test(v)) {
        if (!min || minSV.compare(v) === 1) {
          min = v;
          minSV = new SemVer(min, options);
        }
      }
    });
    return min;
  }
  exports2.minVersion = minVersion;
  function minVersion(range, loose) {
    range = new Range(range, loose);
    var minver = new SemVer("0.0.0");
    if (range.test(minver)) {
      return minver;
    }
    minver = new SemVer("0.0.0-0");
    if (range.test(minver)) {
      return minver;
    }
    minver = null;
    for (var i2 = 0; i2 < range.set.length; ++i2) {
      var comparators = range.set[i2];
      comparators.forEach(function(comparator) {
        var compver = new SemVer(comparator.semver.version);
        switch (comparator.operator) {
          case ">":
            if (compver.prerelease.length === 0) {
              compver.patch++;
            } else {
              compver.prerelease.push(0);
            }
            compver.raw = compver.format();
          case "":
          case ">=":
            if (!minver || gt(minver, compver)) {
              minver = compver;
            }
            break;
          case "<":
          case "<=":
            break;
          default:
            throw new Error("Unexpected operation: " + comparator.operator);
        }
      });
    }
    if (minver && range.test(minver)) {
      return minver;
    }
    return null;
  }
  exports2.validRange = validRange;
  function validRange(range, options) {
    try {
      return new Range(range, options).range || "*";
    } catch (er) {
      return null;
    }
  }
  exports2.ltr = ltr;
  function ltr(version, range, options) {
    return outside(version, range, "<", options);
  }
  exports2.gtr = gtr;
  function gtr(version, range, options) {
    return outside(version, range, ">", options);
  }
  exports2.outside = outside;
  function outside(version, range, hilo, options) {
    version = new SemVer(version, options);
    range = new Range(range, options);
    var gtfn, ltefn, ltfn, comp, ecomp;
    switch (hilo) {
      case ">":
        gtfn = gt;
        ltefn = lte;
        ltfn = lt;
        comp = ">";
        ecomp = ">=";
        break;
      case "<":
        gtfn = lt;
        ltefn = gte;
        ltfn = gt;
        comp = "<";
        ecomp = "<=";
        break;
      default:
        throw new TypeError('Must provide a hilo val of "<" or ">"');
    }
    if (satisfies(version, range, options)) {
      return false;
    }
    for (var i2 = 0; i2 < range.set.length; ++i2) {
      var comparators = range.set[i2];
      var high = null;
      var low = null;
      comparators.forEach(function(comparator) {
        if (comparator.semver === ANY) {
          comparator = new Comparator(">=0.0.0");
        }
        high = high || comparator;
        low = low || comparator;
        if (gtfn(comparator.semver, high.semver, options)) {
          high = comparator;
        } else if (ltfn(comparator.semver, low.semver, options)) {
          low = comparator;
        }
      });
      if (high.operator === comp || high.operator === ecomp) {
        return false;
      }
      if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
        return false;
      } else if (low.operator === ecomp && ltfn(version, low.semver)) {
        return false;
      }
    }
    return true;
  }
  exports2.prerelease = prerelease;
  function prerelease(version, options) {
    var parsed = parse(version, options);
    return parsed && parsed.prerelease.length ? parsed.prerelease : null;
  }
  exports2.intersects = intersects;
  function intersects(r1, r2, options) {
    r1 = new Range(r1, options);
    r2 = new Range(r2, options);
    return r1.intersects(r2);
  }
  exports2.coerce = coerce;
  function coerce(version, options) {
    if (version instanceof SemVer) {
      return version;
    }
    if (typeof version === "number") {
      version = String(version);
    }
    if (typeof version !== "string") {
      return null;
    }
    options = options || {};
    var match = null;
    if (!options.rtl) {
      match = version.match(re[t.COERCE]);
    } else {
      var next;
      while ((next = re[t.COERCERTL].exec(version)) && (!match || match.index + match[0].length !== version.length)) {
        if (!match || next.index + next[0].length !== match.index + match[0].length) {
          match = next;
        }
        re[t.COERCERTL].lastIndex = next.index + next[1].length + next[2].length;
      }
      re[t.COERCERTL].lastIndex = -1;
    }
    if (match === null) {
      return null;
    }
    return parse(match[2] + "." + (match[3] || "0") + "." + (match[4] || "0"), options);
  }
});

// node_modules/vscode-jsonrpc/lib/is.js
var require_is = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  function boolean(value) {
    return value === true || value === false;
  }
  exports2.boolean = boolean;
  function string(value) {
    return typeof value === "string" || value instanceof String;
  }
  exports2.string = string;
  function number(value) {
    return typeof value === "number" || value instanceof Number;
  }
  exports2.number = number;
  function error(value) {
    return value instanceof Error;
  }
  exports2.error = error;
  function func(value) {
    return typeof value === "function";
  }
  exports2.func = func;
  function array(value) {
    return Array.isArray(value);
  }
  exports2.array = array;
  function stringArray(value) {
    return array(value) && value.every((elem) => string(elem));
  }
  exports2.stringArray = stringArray;
});

// node_modules/vscode-jsonrpc/lib/messages.js
var require_messages = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var is = require_is();
  var ErrorCodes;
  (function(ErrorCodes2) {
    ErrorCodes2.ParseError = -32700;
    ErrorCodes2.InvalidRequest = -32600;
    ErrorCodes2.MethodNotFound = -32601;
    ErrorCodes2.InvalidParams = -32602;
    ErrorCodes2.InternalError = -32603;
    ErrorCodes2.serverErrorStart = -32099;
    ErrorCodes2.serverErrorEnd = -32e3;
    ErrorCodes2.ServerNotInitialized = -32002;
    ErrorCodes2.UnknownErrorCode = -32001;
    ErrorCodes2.RequestCancelled = -32800;
    ErrorCodes2.ContentModified = -32801;
    ErrorCodes2.MessageWriteError = 1;
    ErrorCodes2.MessageReadError = 2;
  })(ErrorCodes = exports2.ErrorCodes || (exports2.ErrorCodes = {}));
  var ResponseError = class extends Error {
    constructor(code, message, data) {
      super(message);
      this.code = is.number(code) ? code : ErrorCodes.UnknownErrorCode;
      this.data = data;
      Object.setPrototypeOf(this, ResponseError.prototype);
    }
    toJson() {
      return {
        code: this.code,
        message: this.message,
        data: this.data
      };
    }
  };
  exports2.ResponseError = ResponseError;
  var AbstractMessageType = class {
    constructor(_method, _numberOfParams) {
      this._method = _method;
      this._numberOfParams = _numberOfParams;
    }
    get method() {
      return this._method;
    }
    get numberOfParams() {
      return this._numberOfParams;
    }
  };
  exports2.AbstractMessageType = AbstractMessageType;
  var RequestType0 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 0);
    }
  };
  exports2.RequestType0 = RequestType0;
  var RequestType = class extends AbstractMessageType {
    constructor(method) {
      super(method, 1);
    }
  };
  exports2.RequestType = RequestType;
  var RequestType1 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 1);
    }
  };
  exports2.RequestType1 = RequestType1;
  var RequestType2 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 2);
    }
  };
  exports2.RequestType2 = RequestType2;
  var RequestType3 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 3);
    }
  };
  exports2.RequestType3 = RequestType3;
  var RequestType4 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 4);
    }
  };
  exports2.RequestType4 = RequestType4;
  var RequestType5 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 5);
    }
  };
  exports2.RequestType5 = RequestType5;
  var RequestType6 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 6);
    }
  };
  exports2.RequestType6 = RequestType6;
  var RequestType7 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 7);
    }
  };
  exports2.RequestType7 = RequestType7;
  var RequestType8 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 8);
    }
  };
  exports2.RequestType8 = RequestType8;
  var RequestType9 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 9);
    }
  };
  exports2.RequestType9 = RequestType9;
  var NotificationType = class extends AbstractMessageType {
    constructor(method) {
      super(method, 1);
      this._ = void 0;
    }
  };
  exports2.NotificationType = NotificationType;
  var NotificationType0 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 0);
    }
  };
  exports2.NotificationType0 = NotificationType0;
  var NotificationType1 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 1);
    }
  };
  exports2.NotificationType1 = NotificationType1;
  var NotificationType2 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 2);
    }
  };
  exports2.NotificationType2 = NotificationType2;
  var NotificationType3 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 3);
    }
  };
  exports2.NotificationType3 = NotificationType3;
  var NotificationType4 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 4);
    }
  };
  exports2.NotificationType4 = NotificationType4;
  var NotificationType5 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 5);
    }
  };
  exports2.NotificationType5 = NotificationType5;
  var NotificationType6 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 6);
    }
  };
  exports2.NotificationType6 = NotificationType6;
  var NotificationType7 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 7);
    }
  };
  exports2.NotificationType7 = NotificationType7;
  var NotificationType8 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 8);
    }
  };
  exports2.NotificationType8 = NotificationType8;
  var NotificationType9 = class extends AbstractMessageType {
    constructor(method) {
      super(method, 9);
    }
  };
  exports2.NotificationType9 = NotificationType9;
  function isRequestMessage(message) {
    let candidate = message;
    return candidate && is.string(candidate.method) && (is.string(candidate.id) || is.number(candidate.id));
  }
  exports2.isRequestMessage = isRequestMessage;
  function isNotificationMessage(message) {
    let candidate = message;
    return candidate && is.string(candidate.method) && message.id === void 0;
  }
  exports2.isNotificationMessage = isNotificationMessage;
  function isResponseMessage(message) {
    let candidate = message;
    return candidate && (candidate.result !== void 0 || !!candidate.error) && (is.string(candidate.id) || is.number(candidate.id) || candidate.id === null);
  }
  exports2.isResponseMessage = isResponseMessage;
});

// node_modules/vscode-jsonrpc/lib/events.js
var require_events = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var Disposable;
  (function(Disposable2) {
    function create(func) {
      return {
        dispose: func
      };
    }
    Disposable2.create = create;
  })(Disposable = exports2.Disposable || (exports2.Disposable = {}));
  var Event;
  (function(Event2) {
    const _disposable = {dispose() {
    }};
    Event2.None = function() {
      return _disposable;
    };
  })(Event = exports2.Event || (exports2.Event = {}));
  var CallbackList = class {
    add(callback, context = null, bucket) {
      if (!this._callbacks) {
        this._callbacks = [];
        this._contexts = [];
      }
      this._callbacks.push(callback);
      this._contexts.push(context);
      if (Array.isArray(bucket)) {
        bucket.push({dispose: () => this.remove(callback, context)});
      }
    }
    remove(callback, context = null) {
      if (!this._callbacks) {
        return;
      }
      var foundCallbackWithDifferentContext = false;
      for (var i = 0, len = this._callbacks.length; i < len; i++) {
        if (this._callbacks[i] === callback) {
          if (this._contexts[i] === context) {
            this._callbacks.splice(i, 1);
            this._contexts.splice(i, 1);
            return;
          } else {
            foundCallbackWithDifferentContext = true;
          }
        }
      }
      if (foundCallbackWithDifferentContext) {
        throw new Error("When adding a listener with a context, you should remove it with the same context");
      }
    }
    invoke(...args) {
      if (!this._callbacks) {
        return [];
      }
      var ret = [], callbacks = this._callbacks.slice(0), contexts = this._contexts.slice(0);
      for (var i = 0, len = callbacks.length; i < len; i++) {
        try {
          ret.push(callbacks[i].apply(contexts[i], args));
        } catch (e) {
          console.error(e);
        }
      }
      return ret;
    }
    isEmpty() {
      return !this._callbacks || this._callbacks.length === 0;
    }
    dispose() {
      this._callbacks = void 0;
      this._contexts = void 0;
    }
  };
  var Emitter = class {
    constructor(_options) {
      this._options = _options;
    }
    get event() {
      if (!this._event) {
        this._event = (listener, thisArgs, disposables) => {
          if (!this._callbacks) {
            this._callbacks = new CallbackList();
          }
          if (this._options && this._options.onFirstListenerAdd && this._callbacks.isEmpty()) {
            this._options.onFirstListenerAdd(this);
          }
          this._callbacks.add(listener, thisArgs);
          let result;
          result = {
            dispose: () => {
              this._callbacks.remove(listener, thisArgs);
              result.dispose = Emitter._noop;
              if (this._options && this._options.onLastListenerRemove && this._callbacks.isEmpty()) {
                this._options.onLastListenerRemove(this);
              }
            }
          };
          if (Array.isArray(disposables)) {
            disposables.push(result);
          }
          return result;
        };
      }
      return this._event;
    }
    fire(event) {
      if (this._callbacks) {
        this._callbacks.invoke.call(this._callbacks, event);
      }
    }
    dispose() {
      if (this._callbacks) {
        this._callbacks.dispose();
        this._callbacks = void 0;
      }
    }
  };
  exports2.Emitter = Emitter;
  Emitter._noop = function() {
  };
});

// node_modules/vscode-jsonrpc/lib/messageReader.js
var require_messageReader = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var events_1 = require_events();
  var Is = require_is();
  var DefaultSize = 8192;
  var CR = Buffer.from("\r", "ascii")[0];
  var LF = Buffer.from("\n", "ascii")[0];
  var CRLF = "\r\n";
  var MessageBuffer = class {
    constructor(encoding = "utf8") {
      this.encoding = encoding;
      this.index = 0;
      this.buffer = Buffer.allocUnsafe(DefaultSize);
    }
    append(chunk) {
      var toAppend = chunk;
      if (typeof chunk === "string") {
        var str = chunk;
        var bufferLen = Buffer.byteLength(str, this.encoding);
        toAppend = Buffer.allocUnsafe(bufferLen);
        toAppend.write(str, 0, bufferLen, this.encoding);
      }
      if (this.buffer.length - this.index >= toAppend.length) {
        toAppend.copy(this.buffer, this.index, 0, toAppend.length);
      } else {
        var newSize = (Math.ceil((this.index + toAppend.length) / DefaultSize) + 1) * DefaultSize;
        if (this.index === 0) {
          this.buffer = Buffer.allocUnsafe(newSize);
          toAppend.copy(this.buffer, 0, 0, toAppend.length);
        } else {
          this.buffer = Buffer.concat([this.buffer.slice(0, this.index), toAppend], newSize);
        }
      }
      this.index += toAppend.length;
    }
    tryReadHeaders() {
      let result = void 0;
      let current = 0;
      while (current + 3 < this.index && (this.buffer[current] !== CR || this.buffer[current + 1] !== LF || this.buffer[current + 2] !== CR || this.buffer[current + 3] !== LF)) {
        current++;
      }
      if (current + 3 >= this.index) {
        return result;
      }
      result = Object.create(null);
      let headers = this.buffer.toString("ascii", 0, current).split(CRLF);
      headers.forEach((header) => {
        let index = header.indexOf(":");
        if (index === -1) {
          throw new Error("Message header must separate key and value using :");
        }
        let key = header.substr(0, index);
        let value = header.substr(index + 1).trim();
        result[key] = value;
      });
      let nextStart = current + 4;
      this.buffer = this.buffer.slice(nextStart);
      this.index = this.index - nextStart;
      return result;
    }
    tryReadContent(length) {
      if (this.index < length) {
        return null;
      }
      let result = this.buffer.toString(this.encoding, 0, length);
      let nextStart = length;
      this.buffer.copy(this.buffer, 0, nextStart);
      this.index = this.index - nextStart;
      return result;
    }
    get numberOfBytes() {
      return this.index;
    }
  };
  var MessageReader;
  (function(MessageReader2) {
    function is(value) {
      let candidate = value;
      return candidate && Is.func(candidate.listen) && Is.func(candidate.dispose) && Is.func(candidate.onError) && Is.func(candidate.onClose) && Is.func(candidate.onPartialMessage);
    }
    MessageReader2.is = is;
  })(MessageReader = exports2.MessageReader || (exports2.MessageReader = {}));
  var AbstractMessageReader = class {
    constructor() {
      this.errorEmitter = new events_1.Emitter();
      this.closeEmitter = new events_1.Emitter();
      this.partialMessageEmitter = new events_1.Emitter();
    }
    dispose() {
      this.errorEmitter.dispose();
      this.closeEmitter.dispose();
    }
    get onError() {
      return this.errorEmitter.event;
    }
    fireError(error) {
      this.errorEmitter.fire(this.asError(error));
    }
    get onClose() {
      return this.closeEmitter.event;
    }
    fireClose() {
      this.closeEmitter.fire(void 0);
    }
    get onPartialMessage() {
      return this.partialMessageEmitter.event;
    }
    firePartialMessage(info) {
      this.partialMessageEmitter.fire(info);
    }
    asError(error) {
      if (error instanceof Error) {
        return error;
      } else {
        return new Error(`Reader received error. Reason: ${Is.string(error.message) ? error.message : "unknown"}`);
      }
    }
  };
  exports2.AbstractMessageReader = AbstractMessageReader;
  var StreamMessageReader = class extends AbstractMessageReader {
    constructor(readable, encoding = "utf8") {
      super();
      this.readable = readable;
      this.buffer = new MessageBuffer(encoding);
      this._partialMessageTimeout = 1e4;
    }
    set partialMessageTimeout(timeout) {
      this._partialMessageTimeout = timeout;
    }
    get partialMessageTimeout() {
      return this._partialMessageTimeout;
    }
    listen(callback) {
      this.nextMessageLength = -1;
      this.messageToken = 0;
      this.partialMessageTimer = void 0;
      this.callback = callback;
      this.readable.on("data", (data) => {
        this.onData(data);
      });
      this.readable.on("error", (error) => this.fireError(error));
      this.readable.on("close", () => this.fireClose());
    }
    onData(data) {
      this.buffer.append(data);
      while (true) {
        if (this.nextMessageLength === -1) {
          let headers = this.buffer.tryReadHeaders();
          if (!headers) {
            return;
          }
          let contentLength = headers["Content-Length"];
          if (!contentLength) {
            throw new Error("Header must provide a Content-Length property.");
          }
          let length = parseInt(contentLength);
          if (isNaN(length)) {
            throw new Error("Content-Length value must be a number.");
          }
          this.nextMessageLength = length;
        }
        var msg = this.buffer.tryReadContent(this.nextMessageLength);
        if (msg === null) {
          this.setPartialMessageTimer();
          return;
        }
        this.clearPartialMessageTimer();
        this.nextMessageLength = -1;
        this.messageToken++;
        var json = JSON.parse(msg);
        this.callback(json);
      }
    }
    clearPartialMessageTimer() {
      if (this.partialMessageTimer) {
        clearTimeout(this.partialMessageTimer);
        this.partialMessageTimer = void 0;
      }
    }
    setPartialMessageTimer() {
      this.clearPartialMessageTimer();
      if (this._partialMessageTimeout <= 0) {
        return;
      }
      this.partialMessageTimer = setTimeout((token, timeout) => {
        this.partialMessageTimer = void 0;
        if (token === this.messageToken) {
          this.firePartialMessage({messageToken: token, waitingTime: timeout});
          this.setPartialMessageTimer();
        }
      }, this._partialMessageTimeout, this.messageToken, this._partialMessageTimeout);
    }
  };
  exports2.StreamMessageReader = StreamMessageReader;
  var IPCMessageReader = class extends AbstractMessageReader {
    constructor(process2) {
      super();
      this.process = process2;
      let eventEmitter = this.process;
      eventEmitter.on("error", (error) => this.fireError(error));
      eventEmitter.on("close", () => this.fireClose());
    }
    listen(callback) {
      this.process.on("message", callback);
    }
  };
  exports2.IPCMessageReader = IPCMessageReader;
  var SocketMessageReader = class extends StreamMessageReader {
    constructor(socket2, encoding = "utf-8") {
      super(socket2, encoding);
    }
  };
  exports2.SocketMessageReader = SocketMessageReader;
});

// node_modules/vscode-jsonrpc/lib/messageWriter.js
var require_messageWriter = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var events_1 = require_events();
  var Is = require_is();
  var ContentLength = "Content-Length: ";
  var CRLF = "\r\n";
  var MessageWriter;
  (function(MessageWriter2) {
    function is(value) {
      let candidate = value;
      return candidate && Is.func(candidate.dispose) && Is.func(candidate.onClose) && Is.func(candidate.onError) && Is.func(candidate.write);
    }
    MessageWriter2.is = is;
  })(MessageWriter = exports2.MessageWriter || (exports2.MessageWriter = {}));
  var AbstractMessageWriter = class {
    constructor() {
      this.errorEmitter = new events_1.Emitter();
      this.closeEmitter = new events_1.Emitter();
    }
    dispose() {
      this.errorEmitter.dispose();
      this.closeEmitter.dispose();
    }
    get onError() {
      return this.errorEmitter.event;
    }
    fireError(error, message, count) {
      this.errorEmitter.fire([this.asError(error), message, count]);
    }
    get onClose() {
      return this.closeEmitter.event;
    }
    fireClose() {
      this.closeEmitter.fire(void 0);
    }
    asError(error) {
      if (error instanceof Error) {
        return error;
      } else {
        return new Error(`Writer received error. Reason: ${Is.string(error.message) ? error.message : "unknown"}`);
      }
    }
  };
  exports2.AbstractMessageWriter = AbstractMessageWriter;
  var StreamMessageWriter = class extends AbstractMessageWriter {
    constructor(writable, encoding = "utf8") {
      super();
      this.writable = writable;
      this.encoding = encoding;
      this.errorCount = 0;
      this.writable.on("error", (error) => this.fireError(error));
      this.writable.on("close", () => this.fireClose());
    }
    write(msg) {
      let json = JSON.stringify(msg);
      let contentLength = Buffer.byteLength(json, this.encoding);
      let headers = [
        ContentLength,
        contentLength.toString(),
        CRLF,
        CRLF
      ];
      try {
        this.writable.write(headers.join(""), "ascii");
        this.writable.write(json, this.encoding);
        this.errorCount = 0;
      } catch (error) {
        this.errorCount++;
        this.fireError(error, msg, this.errorCount);
      }
    }
  };
  exports2.StreamMessageWriter = StreamMessageWriter;
  var IPCMessageWriter = class extends AbstractMessageWriter {
    constructor(process2) {
      super();
      this.process = process2;
      this.errorCount = 0;
      this.queue = [];
      this.sending = false;
      let eventEmitter = this.process;
      eventEmitter.on("error", (error) => this.fireError(error));
      eventEmitter.on("close", () => this.fireClose);
    }
    write(msg) {
      if (!this.sending && this.queue.length === 0) {
        this.doWriteMessage(msg);
      } else {
        this.queue.push(msg);
      }
    }
    doWriteMessage(msg) {
      try {
        if (this.process.send) {
          this.sending = true;
          this.process.send(msg, void 0, void 0, (error) => {
            this.sending = false;
            if (error) {
              this.errorCount++;
              this.fireError(error, msg, this.errorCount);
            } else {
              this.errorCount = 0;
            }
            if (this.queue.length > 0) {
              this.doWriteMessage(this.queue.shift());
            }
          });
        }
      } catch (error) {
        this.errorCount++;
        this.fireError(error, msg, this.errorCount);
      }
    }
  };
  exports2.IPCMessageWriter = IPCMessageWriter;
  var SocketMessageWriter = class extends AbstractMessageWriter {
    constructor(socket2, encoding = "utf8") {
      super();
      this.socket = socket2;
      this.queue = [];
      this.sending = false;
      this.encoding = encoding;
      this.errorCount = 0;
      this.socket.on("error", (error) => this.fireError(error));
      this.socket.on("close", () => this.fireClose());
    }
    dispose() {
      super.dispose();
      this.socket.destroy();
    }
    write(msg) {
      if (!this.sending && this.queue.length === 0) {
        this.doWriteMessage(msg);
      } else {
        this.queue.push(msg);
      }
    }
    doWriteMessage(msg) {
      let json = JSON.stringify(msg);
      let contentLength = Buffer.byteLength(json, this.encoding);
      let headers = [
        ContentLength,
        contentLength.toString(),
        CRLF,
        CRLF
      ];
      try {
        this.sending = true;
        this.socket.write(headers.join(""), "ascii", (error) => {
          if (error) {
            this.handleError(error, msg);
          }
          try {
            this.socket.write(json, this.encoding, (error2) => {
              this.sending = false;
              if (error2) {
                this.handleError(error2, msg);
              } else {
                this.errorCount = 0;
              }
              if (this.queue.length > 0) {
                this.doWriteMessage(this.queue.shift());
              }
            });
          } catch (error2) {
            this.handleError(error2, msg);
          }
        });
      } catch (error) {
        this.handleError(error, msg);
      }
    }
    handleError(error, msg) {
      this.errorCount++;
      this.fireError(error, msg, this.errorCount);
    }
  };
  exports2.SocketMessageWriter = SocketMessageWriter;
});

// node_modules/vscode-jsonrpc/lib/cancellation.js
var require_cancellation = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var events_1 = require_events();
  var Is = require_is();
  var CancellationToken;
  (function(CancellationToken2) {
    CancellationToken2.None = Object.freeze({
      isCancellationRequested: false,
      onCancellationRequested: events_1.Event.None
    });
    CancellationToken2.Cancelled = Object.freeze({
      isCancellationRequested: true,
      onCancellationRequested: events_1.Event.None
    });
    function is(value) {
      let candidate = value;
      return candidate && (candidate === CancellationToken2.None || candidate === CancellationToken2.Cancelled || Is.boolean(candidate.isCancellationRequested) && !!candidate.onCancellationRequested);
    }
    CancellationToken2.is = is;
  })(CancellationToken = exports2.CancellationToken || (exports2.CancellationToken = {}));
  var shortcutEvent = Object.freeze(function(callback, context) {
    let handle = setTimeout(callback.bind(context), 0);
    return {dispose() {
      clearTimeout(handle);
    }};
  });
  var MutableToken = class {
    constructor() {
      this._isCancelled = false;
    }
    cancel() {
      if (!this._isCancelled) {
        this._isCancelled = true;
        if (this._emitter) {
          this._emitter.fire(void 0);
          this.dispose();
        }
      }
    }
    get isCancellationRequested() {
      return this._isCancelled;
    }
    get onCancellationRequested() {
      if (this._isCancelled) {
        return shortcutEvent;
      }
      if (!this._emitter) {
        this._emitter = new events_1.Emitter();
      }
      return this._emitter.event;
    }
    dispose() {
      if (this._emitter) {
        this._emitter.dispose();
        this._emitter = void 0;
      }
    }
  };
  var CancellationTokenSource = class {
    get token() {
      if (!this._token) {
        this._token = new MutableToken();
      }
      return this._token;
    }
    cancel() {
      if (!this._token) {
        this._token = CancellationToken.Cancelled;
      } else {
        this._token.cancel();
      }
    }
    dispose() {
      if (!this._token) {
        this._token = CancellationToken.None;
      } else if (this._token instanceof MutableToken) {
        this._token.dispose();
      }
    }
  };
  exports2.CancellationTokenSource = CancellationTokenSource;
});

// node_modules/vscode-jsonrpc/lib/linkedMap.js
var require_linkedMap = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var Touch;
  (function(Touch2) {
    Touch2.None = 0;
    Touch2.First = 1;
    Touch2.Last = 2;
  })(Touch = exports2.Touch || (exports2.Touch = {}));
  var LinkedMap = class {
    constructor() {
      this._map = new Map();
      this._head = void 0;
      this._tail = void 0;
      this._size = 0;
    }
    clear() {
      this._map.clear();
      this._head = void 0;
      this._tail = void 0;
      this._size = 0;
    }
    isEmpty() {
      return !this._head && !this._tail;
    }
    get size() {
      return this._size;
    }
    has(key) {
      return this._map.has(key);
    }
    get(key) {
      const item = this._map.get(key);
      if (!item) {
        return void 0;
      }
      return item.value;
    }
    set(key, value, touch = Touch.None) {
      let item = this._map.get(key);
      if (item) {
        item.value = value;
        if (touch !== Touch.None) {
          this.touch(item, touch);
        }
      } else {
        item = {key, value, next: void 0, previous: void 0};
        switch (touch) {
          case Touch.None:
            this.addItemLast(item);
            break;
          case Touch.First:
            this.addItemFirst(item);
            break;
          case Touch.Last:
            this.addItemLast(item);
            break;
          default:
            this.addItemLast(item);
            break;
        }
        this._map.set(key, item);
        this._size++;
      }
    }
    delete(key) {
      const item = this._map.get(key);
      if (!item) {
        return false;
      }
      this._map.delete(key);
      this.removeItem(item);
      this._size--;
      return true;
    }
    shift() {
      if (!this._head && !this._tail) {
        return void 0;
      }
      if (!this._head || !this._tail) {
        throw new Error("Invalid list");
      }
      const item = this._head;
      this._map.delete(item.key);
      this.removeItem(item);
      this._size--;
      return item.value;
    }
    forEach(callbackfn, thisArg) {
      let current = this._head;
      while (current) {
        if (thisArg) {
          callbackfn.bind(thisArg)(current.value, current.key, this);
        } else {
          callbackfn(current.value, current.key, this);
        }
        current = current.next;
      }
    }
    forEachReverse(callbackfn, thisArg) {
      let current = this._tail;
      while (current) {
        if (thisArg) {
          callbackfn.bind(thisArg)(current.value, current.key, this);
        } else {
          callbackfn(current.value, current.key, this);
        }
        current = current.previous;
      }
    }
    values() {
      let result = [];
      let current = this._head;
      while (current) {
        result.push(current.value);
        current = current.next;
      }
      return result;
    }
    keys() {
      let result = [];
      let current = this._head;
      while (current) {
        result.push(current.key);
        current = current.next;
      }
      return result;
    }
    addItemFirst(item) {
      if (!this._head && !this._tail) {
        this._tail = item;
      } else if (!this._head) {
        throw new Error("Invalid list");
      } else {
        item.next = this._head;
        this._head.previous = item;
      }
      this._head = item;
    }
    addItemLast(item) {
      if (!this._head && !this._tail) {
        this._head = item;
      } else if (!this._tail) {
        throw new Error("Invalid list");
      } else {
        item.previous = this._tail;
        this._tail.next = item;
      }
      this._tail = item;
    }
    removeItem(item) {
      if (item === this._head && item === this._tail) {
        this._head = void 0;
        this._tail = void 0;
      } else if (item === this._head) {
        this._head = item.next;
      } else if (item === this._tail) {
        this._tail = item.previous;
      } else {
        const next = item.next;
        const previous = item.previous;
        if (!next || !previous) {
          throw new Error("Invalid list");
        }
        next.previous = previous;
        previous.next = next;
      }
    }
    touch(item, touch) {
      if (!this._head || !this._tail) {
        throw new Error("Invalid list");
      }
      if (touch !== Touch.First && touch !== Touch.Last) {
        return;
      }
      if (touch === Touch.First) {
        if (item === this._head) {
          return;
        }
        const next = item.next;
        const previous = item.previous;
        if (item === this._tail) {
          previous.next = void 0;
          this._tail = previous;
        } else {
          next.previous = previous;
          previous.next = next;
        }
        item.previous = void 0;
        item.next = this._head;
        this._head.previous = item;
        this._head = item;
      } else if (touch === Touch.Last) {
        if (item === this._tail) {
          return;
        }
        const next = item.next;
        const previous = item.previous;
        if (item === this._head) {
          next.previous = void 0;
          this._head = next;
        } else {
          next.previous = previous;
          previous.next = next;
        }
        item.next = void 0;
        item.previous = this._tail;
        this._tail.next = item;
        this._tail = item;
      }
    }
  };
  exports2.LinkedMap = LinkedMap;
});

// node_modules/vscode-jsonrpc/lib/pipeSupport.js
var require_pipeSupport = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var path_1 = require("path");
  var os_1 = require("os");
  var crypto_1 = require("crypto");
  var net_1 = require("net");
  var messageReader_1 = require_messageReader();
  var messageWriter_1 = require_messageWriter();
  function generateRandomPipeName() {
    const randomSuffix = crypto_1.randomBytes(21).toString("hex");
    if (process.platform === "win32") {
      return `\\\\.\\pipe\\vscode-jsonrpc-${randomSuffix}-sock`;
    } else {
      return path_1.join(os_1.tmpdir(), `vscode-${randomSuffix}.sock`);
    }
  }
  exports2.generateRandomPipeName = generateRandomPipeName;
  function createClientPipeTransport(pipeName, encoding = "utf-8") {
    let connectResolve;
    let connected = new Promise((resolve, _reject) => {
      connectResolve = resolve;
    });
    return new Promise((resolve, reject) => {
      let server = net_1.createServer((socket2) => {
        server.close();
        connectResolve([
          new messageReader_1.SocketMessageReader(socket2, encoding),
          new messageWriter_1.SocketMessageWriter(socket2, encoding)
        ]);
      });
      server.on("error", reject);
      server.listen(pipeName, () => {
        server.removeListener("error", reject);
        resolve({
          onConnected: () => {
            return connected;
          }
        });
      });
    });
  }
  exports2.createClientPipeTransport = createClientPipeTransport;
  function createServerPipeTransport(pipeName, encoding = "utf-8") {
    const socket2 = net_1.createConnection(pipeName);
    return [
      new messageReader_1.SocketMessageReader(socket2, encoding),
      new messageWriter_1.SocketMessageWriter(socket2, encoding)
    ];
  }
  exports2.createServerPipeTransport = createServerPipeTransport;
});

// node_modules/vscode-jsonrpc/lib/socketSupport.js
var require_socketSupport = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var net_1 = require("net");
  var messageReader_1 = require_messageReader();
  var messageWriter_1 = require_messageWriter();
  function createClientSocketTransport(port, encoding = "utf-8") {
    let connectResolve;
    let connected = new Promise((resolve, _reject) => {
      connectResolve = resolve;
    });
    return new Promise((resolve, reject) => {
      let server = net_1.createServer((socket2) => {
        server.close();
        connectResolve([
          new messageReader_1.SocketMessageReader(socket2, encoding),
          new messageWriter_1.SocketMessageWriter(socket2, encoding)
        ]);
      });
      server.on("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve({
          onConnected: () => {
            return connected;
          }
        });
      });
    });
  }
  exports2.createClientSocketTransport = createClientSocketTransport;
  function createServerSocketTransport(port, encoding = "utf-8") {
    const socket2 = net_1.createConnection(port, "127.0.0.1");
    return [
      new messageReader_1.SocketMessageReader(socket2, encoding),
      new messageWriter_1.SocketMessageWriter(socket2, encoding)
    ];
  }
  exports2.createServerSocketTransport = createServerSocketTransport;
});

// node_modules/vscode-jsonrpc/lib/main.js
var require_main = __commonJS((exports2) => {
  "use strict";
  function __export2(m) {
    for (var p in m)
      if (!exports2.hasOwnProperty(p))
        exports2[p] = m[p];
  }
  Object.defineProperty(exports2, "__esModule", {value: true});
  var Is = require_is();
  var messages_1 = require_messages();
  exports2.RequestType = messages_1.RequestType;
  exports2.RequestType0 = messages_1.RequestType0;
  exports2.RequestType1 = messages_1.RequestType1;
  exports2.RequestType2 = messages_1.RequestType2;
  exports2.RequestType3 = messages_1.RequestType3;
  exports2.RequestType4 = messages_1.RequestType4;
  exports2.RequestType5 = messages_1.RequestType5;
  exports2.RequestType6 = messages_1.RequestType6;
  exports2.RequestType7 = messages_1.RequestType7;
  exports2.RequestType8 = messages_1.RequestType8;
  exports2.RequestType9 = messages_1.RequestType9;
  exports2.ResponseError = messages_1.ResponseError;
  exports2.ErrorCodes = messages_1.ErrorCodes;
  exports2.NotificationType = messages_1.NotificationType;
  exports2.NotificationType0 = messages_1.NotificationType0;
  exports2.NotificationType1 = messages_1.NotificationType1;
  exports2.NotificationType2 = messages_1.NotificationType2;
  exports2.NotificationType3 = messages_1.NotificationType3;
  exports2.NotificationType4 = messages_1.NotificationType4;
  exports2.NotificationType5 = messages_1.NotificationType5;
  exports2.NotificationType6 = messages_1.NotificationType6;
  exports2.NotificationType7 = messages_1.NotificationType7;
  exports2.NotificationType8 = messages_1.NotificationType8;
  exports2.NotificationType9 = messages_1.NotificationType9;
  var messageReader_1 = require_messageReader();
  exports2.MessageReader = messageReader_1.MessageReader;
  exports2.StreamMessageReader = messageReader_1.StreamMessageReader;
  exports2.IPCMessageReader = messageReader_1.IPCMessageReader;
  exports2.SocketMessageReader = messageReader_1.SocketMessageReader;
  var messageWriter_1 = require_messageWriter();
  exports2.MessageWriter = messageWriter_1.MessageWriter;
  exports2.StreamMessageWriter = messageWriter_1.StreamMessageWriter;
  exports2.IPCMessageWriter = messageWriter_1.IPCMessageWriter;
  exports2.SocketMessageWriter = messageWriter_1.SocketMessageWriter;
  var events_1 = require_events();
  exports2.Disposable = events_1.Disposable;
  exports2.Event = events_1.Event;
  exports2.Emitter = events_1.Emitter;
  var cancellation_1 = require_cancellation();
  exports2.CancellationTokenSource = cancellation_1.CancellationTokenSource;
  exports2.CancellationToken = cancellation_1.CancellationToken;
  var linkedMap_1 = require_linkedMap();
  __export2(require_pipeSupport());
  __export2(require_socketSupport());
  var CancelNotification;
  (function(CancelNotification2) {
    CancelNotification2.type = new messages_1.NotificationType("$/cancelRequest");
  })(CancelNotification || (CancelNotification = {}));
  var ProgressNotification;
  (function(ProgressNotification2) {
    ProgressNotification2.type = new messages_1.NotificationType("$/progress");
  })(ProgressNotification || (ProgressNotification = {}));
  var ProgressType = class {
    constructor() {
    }
  };
  exports2.ProgressType = ProgressType;
  exports2.NullLogger = Object.freeze({
    error: () => {
    },
    warn: () => {
    },
    info: () => {
    },
    log: () => {
    }
  });
  var Trace;
  (function(Trace2) {
    Trace2[Trace2["Off"] = 0] = "Off";
    Trace2[Trace2["Messages"] = 1] = "Messages";
    Trace2[Trace2["Verbose"] = 2] = "Verbose";
  })(Trace = exports2.Trace || (exports2.Trace = {}));
  (function(Trace2) {
    function fromString(value) {
      if (!Is.string(value)) {
        return Trace2.Off;
      }
      value = value.toLowerCase();
      switch (value) {
        case "off":
          return Trace2.Off;
        case "messages":
          return Trace2.Messages;
        case "verbose":
          return Trace2.Verbose;
        default:
          return Trace2.Off;
      }
    }
    Trace2.fromString = fromString;
    function toString(value) {
      switch (value) {
        case Trace2.Off:
          return "off";
        case Trace2.Messages:
          return "messages";
        case Trace2.Verbose:
          return "verbose";
        default:
          return "off";
      }
    }
    Trace2.toString = toString;
  })(Trace = exports2.Trace || (exports2.Trace = {}));
  var TraceFormat;
  (function(TraceFormat2) {
    TraceFormat2["Text"] = "text";
    TraceFormat2["JSON"] = "json";
  })(TraceFormat = exports2.TraceFormat || (exports2.TraceFormat = {}));
  (function(TraceFormat2) {
    function fromString(value) {
      value = value.toLowerCase();
      if (value === "json") {
        return TraceFormat2.JSON;
      } else {
        return TraceFormat2.Text;
      }
    }
    TraceFormat2.fromString = fromString;
  })(TraceFormat = exports2.TraceFormat || (exports2.TraceFormat = {}));
  var SetTraceNotification;
  (function(SetTraceNotification2) {
    SetTraceNotification2.type = new messages_1.NotificationType("$/setTraceNotification");
  })(SetTraceNotification = exports2.SetTraceNotification || (exports2.SetTraceNotification = {}));
  var LogTraceNotification;
  (function(LogTraceNotification2) {
    LogTraceNotification2.type = new messages_1.NotificationType("$/logTraceNotification");
  })(LogTraceNotification = exports2.LogTraceNotification || (exports2.LogTraceNotification = {}));
  var ConnectionErrors;
  (function(ConnectionErrors2) {
    ConnectionErrors2[ConnectionErrors2["Closed"] = 1] = "Closed";
    ConnectionErrors2[ConnectionErrors2["Disposed"] = 2] = "Disposed";
    ConnectionErrors2[ConnectionErrors2["AlreadyListening"] = 3] = "AlreadyListening";
  })(ConnectionErrors = exports2.ConnectionErrors || (exports2.ConnectionErrors = {}));
  var ConnectionError = class extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
      Object.setPrototypeOf(this, ConnectionError.prototype);
    }
  };
  exports2.ConnectionError = ConnectionError;
  var ConnectionStrategy;
  (function(ConnectionStrategy2) {
    function is(value) {
      let candidate = value;
      return candidate && Is.func(candidate.cancelUndispatched);
    }
    ConnectionStrategy2.is = is;
  })(ConnectionStrategy = exports2.ConnectionStrategy || (exports2.ConnectionStrategy = {}));
  var ConnectionState;
  (function(ConnectionState2) {
    ConnectionState2[ConnectionState2["New"] = 1] = "New";
    ConnectionState2[ConnectionState2["Listening"] = 2] = "Listening";
    ConnectionState2[ConnectionState2["Closed"] = 3] = "Closed";
    ConnectionState2[ConnectionState2["Disposed"] = 4] = "Disposed";
  })(ConnectionState || (ConnectionState = {}));
  function _createMessageConnection(messageReader, messageWriter, logger, strategy) {
    let sequenceNumber = 0;
    let notificationSquenceNumber = 0;
    let unknownResponseSquenceNumber = 0;
    const version = "2.0";
    let starRequestHandler = void 0;
    let requestHandlers = Object.create(null);
    let starNotificationHandler = void 0;
    let notificationHandlers = Object.create(null);
    let progressHandlers = new Map();
    let timer;
    let messageQueue = new linkedMap_1.LinkedMap();
    let responsePromises = Object.create(null);
    let requestTokens = Object.create(null);
    let trace = Trace.Off;
    let traceFormat = TraceFormat.Text;
    let tracer;
    let state = ConnectionState.New;
    let errorEmitter = new events_1.Emitter();
    let closeEmitter = new events_1.Emitter();
    let unhandledNotificationEmitter = new events_1.Emitter();
    let unhandledProgressEmitter = new events_1.Emitter();
    let disposeEmitter = new events_1.Emitter();
    function createRequestQueueKey(id) {
      return "req-" + id.toString();
    }
    function createResponseQueueKey(id) {
      if (id === null) {
        return "res-unknown-" + (++unknownResponseSquenceNumber).toString();
      } else {
        return "res-" + id.toString();
      }
    }
    function createNotificationQueueKey() {
      return "not-" + (++notificationSquenceNumber).toString();
    }
    function addMessageToQueue(queue, message) {
      if (messages_1.isRequestMessage(message)) {
        queue.set(createRequestQueueKey(message.id), message);
      } else if (messages_1.isResponseMessage(message)) {
        queue.set(createResponseQueueKey(message.id), message);
      } else {
        queue.set(createNotificationQueueKey(), message);
      }
    }
    function cancelUndispatched(_message) {
      return void 0;
    }
    function isListening() {
      return state === ConnectionState.Listening;
    }
    function isClosed() {
      return state === ConnectionState.Closed;
    }
    function isDisposed() {
      return state === ConnectionState.Disposed;
    }
    function closeHandler() {
      if (state === ConnectionState.New || state === ConnectionState.Listening) {
        state = ConnectionState.Closed;
        closeEmitter.fire(void 0);
      }
    }
    function readErrorHandler(error) {
      errorEmitter.fire([error, void 0, void 0]);
    }
    function writeErrorHandler(data) {
      errorEmitter.fire(data);
    }
    messageReader.onClose(closeHandler);
    messageReader.onError(readErrorHandler);
    messageWriter.onClose(closeHandler);
    messageWriter.onError(writeErrorHandler);
    function triggerMessageQueue() {
      if (timer || messageQueue.size === 0) {
        return;
      }
      timer = setImmediate(() => {
        timer = void 0;
        processMessageQueue();
      });
    }
    function processMessageQueue() {
      if (messageQueue.size === 0) {
        return;
      }
      let message = messageQueue.shift();
      try {
        if (messages_1.isRequestMessage(message)) {
          handleRequest(message);
        } else if (messages_1.isNotificationMessage(message)) {
          handleNotification(message);
        } else if (messages_1.isResponseMessage(message)) {
          handleResponse(message);
        } else {
          handleInvalidMessage(message);
        }
      } finally {
        triggerMessageQueue();
      }
    }
    let callback = (message) => {
      try {
        if (messages_1.isNotificationMessage(message) && message.method === CancelNotification.type.method) {
          let key = createRequestQueueKey(message.params.id);
          let toCancel = messageQueue.get(key);
          if (messages_1.isRequestMessage(toCancel)) {
            let response = strategy && strategy.cancelUndispatched ? strategy.cancelUndispatched(toCancel, cancelUndispatched) : cancelUndispatched(toCancel);
            if (response && (response.error !== void 0 || response.result !== void 0)) {
              messageQueue.delete(key);
              response.id = toCancel.id;
              traceSendingResponse(response, message.method, Date.now());
              messageWriter.write(response);
              return;
            }
          }
        }
        addMessageToQueue(messageQueue, message);
      } finally {
        triggerMessageQueue();
      }
    };
    function handleRequest(requestMessage) {
      if (isDisposed()) {
        return;
      }
      function reply(resultOrError, method, startTime2) {
        let message = {
          jsonrpc: version,
          id: requestMessage.id
        };
        if (resultOrError instanceof messages_1.ResponseError) {
          message.error = resultOrError.toJson();
        } else {
          message.result = resultOrError === void 0 ? null : resultOrError;
        }
        traceSendingResponse(message, method, startTime2);
        messageWriter.write(message);
      }
      function replyError(error, method, startTime2) {
        let message = {
          jsonrpc: version,
          id: requestMessage.id,
          error: error.toJson()
        };
        traceSendingResponse(message, method, startTime2);
        messageWriter.write(message);
      }
      function replySuccess(result, method, startTime2) {
        if (result === void 0) {
          result = null;
        }
        let message = {
          jsonrpc: version,
          id: requestMessage.id,
          result
        };
        traceSendingResponse(message, method, startTime2);
        messageWriter.write(message);
      }
      traceReceivedRequest(requestMessage);
      let element = requestHandlers[requestMessage.method];
      let type;
      let requestHandler;
      if (element) {
        type = element.type;
        requestHandler = element.handler;
      }
      let startTime = Date.now();
      if (requestHandler || starRequestHandler) {
        let cancellationSource = new cancellation_1.CancellationTokenSource();
        let tokenKey = String(requestMessage.id);
        requestTokens[tokenKey] = cancellationSource;
        try {
          let handlerResult;
          if (requestMessage.params === void 0 || type !== void 0 && type.numberOfParams === 0) {
            handlerResult = requestHandler ? requestHandler(cancellationSource.token) : starRequestHandler(requestMessage.method, cancellationSource.token);
          } else if (Is.array(requestMessage.params) && (type === void 0 || type.numberOfParams > 1)) {
            handlerResult = requestHandler ? requestHandler(...requestMessage.params, cancellationSource.token) : starRequestHandler(requestMessage.method, ...requestMessage.params, cancellationSource.token);
          } else {
            handlerResult = requestHandler ? requestHandler(requestMessage.params, cancellationSource.token) : starRequestHandler(requestMessage.method, requestMessage.params, cancellationSource.token);
          }
          let promise = handlerResult;
          if (!handlerResult) {
            delete requestTokens[tokenKey];
            replySuccess(handlerResult, requestMessage.method, startTime);
          } else if (promise.then) {
            promise.then((resultOrError) => {
              delete requestTokens[tokenKey];
              reply(resultOrError, requestMessage.method, startTime);
            }, (error) => {
              delete requestTokens[tokenKey];
              if (error instanceof messages_1.ResponseError) {
                replyError(error, requestMessage.method, startTime);
              } else if (error && Is.string(error.message)) {
                replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed with message: ${error.message}`), requestMessage.method, startTime);
              } else {
                replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed unexpectedly without providing any details.`), requestMessage.method, startTime);
              }
            });
          } else {
            delete requestTokens[tokenKey];
            reply(handlerResult, requestMessage.method, startTime);
          }
        } catch (error) {
          delete requestTokens[tokenKey];
          if (error instanceof messages_1.ResponseError) {
            reply(error, requestMessage.method, startTime);
          } else if (error && Is.string(error.message)) {
            replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed with message: ${error.message}`), requestMessage.method, startTime);
          } else {
            replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed unexpectedly without providing any details.`), requestMessage.method, startTime);
          }
        }
      } else {
        replyError(new messages_1.ResponseError(messages_1.ErrorCodes.MethodNotFound, `Unhandled method ${requestMessage.method}`), requestMessage.method, startTime);
      }
    }
    function handleResponse(responseMessage) {
      if (isDisposed()) {
        return;
      }
      if (responseMessage.id === null) {
        if (responseMessage.error) {
          logger.error(`Received response message without id: Error is: 
${JSON.stringify(responseMessage.error, void 0, 4)}`);
        } else {
          logger.error(`Received response message without id. No further error information provided.`);
        }
      } else {
        let key = String(responseMessage.id);
        let responsePromise = responsePromises[key];
        traceReceivedResponse(responseMessage, responsePromise);
        if (responsePromise) {
          delete responsePromises[key];
          try {
            if (responseMessage.error) {
              let error = responseMessage.error;
              responsePromise.reject(new messages_1.ResponseError(error.code, error.message, error.data));
            } else if (responseMessage.result !== void 0) {
              responsePromise.resolve(responseMessage.result);
            } else {
              throw new Error("Should never happen.");
            }
          } catch (error) {
            if (error.message) {
              logger.error(`Response handler '${responsePromise.method}' failed with message: ${error.message}`);
            } else {
              logger.error(`Response handler '${responsePromise.method}' failed unexpectedly.`);
            }
          }
        }
      }
    }
    function handleNotification(message) {
      if (isDisposed()) {
        return;
      }
      let type = void 0;
      let notificationHandler;
      if (message.method === CancelNotification.type.method) {
        notificationHandler = (params) => {
          let id = params.id;
          let source = requestTokens[String(id)];
          if (source) {
            source.cancel();
          }
        };
      } else {
        let element = notificationHandlers[message.method];
        if (element) {
          notificationHandler = element.handler;
          type = element.type;
        }
      }
      if (notificationHandler || starNotificationHandler) {
        try {
          traceReceivedNotification(message);
          if (message.params === void 0 || type !== void 0 && type.numberOfParams === 0) {
            notificationHandler ? notificationHandler() : starNotificationHandler(message.method);
          } else if (Is.array(message.params) && (type === void 0 || type.numberOfParams > 1)) {
            notificationHandler ? notificationHandler(...message.params) : starNotificationHandler(message.method, ...message.params);
          } else {
            notificationHandler ? notificationHandler(message.params) : starNotificationHandler(message.method, message.params);
          }
        } catch (error) {
          if (error.message) {
            logger.error(`Notification handler '${message.method}' failed with message: ${error.message}`);
          } else {
            logger.error(`Notification handler '${message.method}' failed unexpectedly.`);
          }
        }
      } else {
        unhandledNotificationEmitter.fire(message);
      }
    }
    function handleInvalidMessage(message) {
      if (!message) {
        logger.error("Received empty message.");
        return;
      }
      logger.error(`Received message which is neither a response nor a notification message:
${JSON.stringify(message, null, 4)}`);
      let responseMessage = message;
      if (Is.string(responseMessage.id) || Is.number(responseMessage.id)) {
        let key = String(responseMessage.id);
        let responseHandler = responsePromises[key];
        if (responseHandler) {
          responseHandler.reject(new Error("The received response has neither a result nor an error property."));
        }
      }
    }
    function traceSendingRequest(message) {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = void 0;
        if (trace === Trace.Verbose && message.params) {
          data = `Params: ${JSON.stringify(message.params, null, 4)}

`;
        }
        tracer.log(`Sending request '${message.method} - (${message.id})'.`, data);
      } else {
        logLSPMessage("send-request", message);
      }
    }
    function traceSendingNotification(message) {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = void 0;
        if (trace === Trace.Verbose) {
          if (message.params) {
            data = `Params: ${JSON.stringify(message.params, null, 4)}

`;
          } else {
            data = "No parameters provided.\n\n";
          }
        }
        tracer.log(`Sending notification '${message.method}'.`, data);
      } else {
        logLSPMessage("send-notification", message);
      }
    }
    function traceSendingResponse(message, method, startTime) {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = void 0;
        if (trace === Trace.Verbose) {
          if (message.error && message.error.data) {
            data = `Error data: ${JSON.stringify(message.error.data, null, 4)}

`;
          } else {
            if (message.result) {
              data = `Result: ${JSON.stringify(message.result, null, 4)}

`;
            } else if (message.error === void 0) {
              data = "No result returned.\n\n";
            }
          }
        }
        tracer.log(`Sending response '${method} - (${message.id})'. Processing request took ${Date.now() - startTime}ms`, data);
      } else {
        logLSPMessage("send-response", message);
      }
    }
    function traceReceivedRequest(message) {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = void 0;
        if (trace === Trace.Verbose && message.params) {
          data = `Params: ${JSON.stringify(message.params, null, 4)}

`;
        }
        tracer.log(`Received request '${message.method} - (${message.id})'.`, data);
      } else {
        logLSPMessage("receive-request", message);
      }
    }
    function traceReceivedNotification(message) {
      if (trace === Trace.Off || !tracer || message.method === LogTraceNotification.type.method) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = void 0;
        if (trace === Trace.Verbose) {
          if (message.params) {
            data = `Params: ${JSON.stringify(message.params, null, 4)}

`;
          } else {
            data = "No parameters provided.\n\n";
          }
        }
        tracer.log(`Received notification '${message.method}'.`, data);
      } else {
        logLSPMessage("receive-notification", message);
      }
    }
    function traceReceivedResponse(message, responsePromise) {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      if (traceFormat === TraceFormat.Text) {
        let data = void 0;
        if (trace === Trace.Verbose) {
          if (message.error && message.error.data) {
            data = `Error data: ${JSON.stringify(message.error.data, null, 4)}

`;
          } else {
            if (message.result) {
              data = `Result: ${JSON.stringify(message.result, null, 4)}

`;
            } else if (message.error === void 0) {
              data = "No result returned.\n\n";
            }
          }
        }
        if (responsePromise) {
          let error = message.error ? ` Request failed: ${message.error.message} (${message.error.code}).` : "";
          tracer.log(`Received response '${responsePromise.method} - (${message.id})' in ${Date.now() - responsePromise.timerStart}ms.${error}`, data);
        } else {
          tracer.log(`Received response ${message.id} without active response promise.`, data);
        }
      } else {
        logLSPMessage("receive-response", message);
      }
    }
    function logLSPMessage(type, message) {
      if (!tracer || trace === Trace.Off) {
        return;
      }
      const lspMessage = {
        isLSPMessage: true,
        type,
        message,
        timestamp: Date.now()
      };
      tracer.log(lspMessage);
    }
    function throwIfClosedOrDisposed() {
      if (isClosed()) {
        throw new ConnectionError(ConnectionErrors.Closed, "Connection is closed.");
      }
      if (isDisposed()) {
        throw new ConnectionError(ConnectionErrors.Disposed, "Connection is disposed.");
      }
    }
    function throwIfListening() {
      if (isListening()) {
        throw new ConnectionError(ConnectionErrors.AlreadyListening, "Connection is already listening");
      }
    }
    function throwIfNotListening() {
      if (!isListening()) {
        throw new Error("Call listen() first.");
      }
    }
    function undefinedToNull(param) {
      if (param === void 0) {
        return null;
      } else {
        return param;
      }
    }
    function computeMessageParams(type, params) {
      let result;
      let numberOfParams = type.numberOfParams;
      switch (numberOfParams) {
        case 0:
          result = null;
          break;
        case 1:
          result = undefinedToNull(params[0]);
          break;
        default:
          result = [];
          for (let i = 0; i < params.length && i < numberOfParams; i++) {
            result.push(undefinedToNull(params[i]));
          }
          if (params.length < numberOfParams) {
            for (let i = params.length; i < numberOfParams; i++) {
              result.push(null);
            }
          }
          break;
      }
      return result;
    }
    let connection = {
      sendNotification: (type, ...params) => {
        throwIfClosedOrDisposed();
        let method;
        let messageParams;
        if (Is.string(type)) {
          method = type;
          switch (params.length) {
            case 0:
              messageParams = null;
              break;
            case 1:
              messageParams = params[0];
              break;
            default:
              messageParams = params;
              break;
          }
        } else {
          method = type.method;
          messageParams = computeMessageParams(type, params);
        }
        let notificationMessage = {
          jsonrpc: version,
          method,
          params: messageParams
        };
        traceSendingNotification(notificationMessage);
        messageWriter.write(notificationMessage);
      },
      onNotification: (type, handler) => {
        throwIfClosedOrDisposed();
        if (Is.func(type)) {
          starNotificationHandler = type;
        } else if (handler) {
          if (Is.string(type)) {
            notificationHandlers[type] = {type: void 0, handler};
          } else {
            notificationHandlers[type.method] = {type, handler};
          }
        }
      },
      onProgress: (_type, token, handler) => {
        if (progressHandlers.has(token)) {
          throw new Error(`Progress handler for token ${token} already registered`);
        }
        progressHandlers.set(token, handler);
        return {
          dispose: () => {
            progressHandlers.delete(token);
          }
        };
      },
      sendProgress: (_type, token, value) => {
        connection.sendNotification(ProgressNotification.type, {token, value});
      },
      onUnhandledProgress: unhandledProgressEmitter.event,
      sendRequest: (type, ...params) => {
        throwIfClosedOrDisposed();
        throwIfNotListening();
        let method;
        let messageParams;
        let token = void 0;
        if (Is.string(type)) {
          method = type;
          switch (params.length) {
            case 0:
              messageParams = null;
              break;
            case 1:
              if (cancellation_1.CancellationToken.is(params[0])) {
                messageParams = null;
                token = params[0];
              } else {
                messageParams = undefinedToNull(params[0]);
              }
              break;
            default:
              const last = params.length - 1;
              if (cancellation_1.CancellationToken.is(params[last])) {
                token = params[last];
                if (params.length === 2) {
                  messageParams = undefinedToNull(params[0]);
                } else {
                  messageParams = params.slice(0, last).map((value) => undefinedToNull(value));
                }
              } else {
                messageParams = params.map((value) => undefinedToNull(value));
              }
              break;
          }
        } else {
          method = type.method;
          messageParams = computeMessageParams(type, params);
          let numberOfParams = type.numberOfParams;
          token = cancellation_1.CancellationToken.is(params[numberOfParams]) ? params[numberOfParams] : void 0;
        }
        let id = sequenceNumber++;
        let result = new Promise((resolve, reject) => {
          let requestMessage = {
            jsonrpc: version,
            id,
            method,
            params: messageParams
          };
          let responsePromise = {method, timerStart: Date.now(), resolve, reject};
          traceSendingRequest(requestMessage);
          try {
            messageWriter.write(requestMessage);
          } catch (e) {
            responsePromise.reject(new messages_1.ResponseError(messages_1.ErrorCodes.MessageWriteError, e.message ? e.message : "Unknown reason"));
            responsePromise = null;
          }
          if (responsePromise) {
            responsePromises[String(id)] = responsePromise;
          }
        });
        if (token) {
          token.onCancellationRequested(() => {
            connection.sendNotification(CancelNotification.type, {id});
          });
        }
        return result;
      },
      onRequest: (type, handler) => {
        throwIfClosedOrDisposed();
        if (Is.func(type)) {
          starRequestHandler = type;
        } else if (handler) {
          if (Is.string(type)) {
            requestHandlers[type] = {type: void 0, handler};
          } else {
            requestHandlers[type.method] = {type, handler};
          }
        }
      },
      trace: (_value, _tracer, sendNotificationOrTraceOptions) => {
        let _sendNotification = false;
        let _traceFormat = TraceFormat.Text;
        if (sendNotificationOrTraceOptions !== void 0) {
          if (Is.boolean(sendNotificationOrTraceOptions)) {
            _sendNotification = sendNotificationOrTraceOptions;
          } else {
            _sendNotification = sendNotificationOrTraceOptions.sendNotification || false;
            _traceFormat = sendNotificationOrTraceOptions.traceFormat || TraceFormat.Text;
          }
        }
        trace = _value;
        traceFormat = _traceFormat;
        if (trace === Trace.Off) {
          tracer = void 0;
        } else {
          tracer = _tracer;
        }
        if (_sendNotification && !isClosed() && !isDisposed()) {
          connection.sendNotification(SetTraceNotification.type, {value: Trace.toString(_value)});
        }
      },
      onError: errorEmitter.event,
      onClose: closeEmitter.event,
      onUnhandledNotification: unhandledNotificationEmitter.event,
      onDispose: disposeEmitter.event,
      dispose: () => {
        if (isDisposed()) {
          return;
        }
        state = ConnectionState.Disposed;
        disposeEmitter.fire(void 0);
        let error = new Error("Connection got disposed.");
        Object.keys(responsePromises).forEach((key) => {
          responsePromises[key].reject(error);
        });
        responsePromises = Object.create(null);
        requestTokens = Object.create(null);
        messageQueue = new linkedMap_1.LinkedMap();
        if (Is.func(messageWriter.dispose)) {
          messageWriter.dispose();
        }
        if (Is.func(messageReader.dispose)) {
          messageReader.dispose();
        }
      },
      listen: () => {
        throwIfClosedOrDisposed();
        throwIfListening();
        state = ConnectionState.Listening;
        messageReader.listen(callback);
      },
      inspect: () => {
        console.log("inspect");
      }
    };
    connection.onNotification(LogTraceNotification.type, (params) => {
      if (trace === Trace.Off || !tracer) {
        return;
      }
      tracer.log(params.message, trace === Trace.Verbose ? params.verbose : void 0);
    });
    connection.onNotification(ProgressNotification.type, (params) => {
      const handler = progressHandlers.get(params.token);
      if (handler) {
        handler(params.value);
      } else {
        unhandledProgressEmitter.fire(params);
      }
    });
    return connection;
  }
  function isMessageReader(value) {
    return value.listen !== void 0 && value.read === void 0;
  }
  function isMessageWriter(value) {
    return value.write !== void 0 && value.end === void 0;
  }
  function createMessageConnection(input, output, logger, strategy) {
    if (!logger) {
      logger = exports2.NullLogger;
    }
    let reader = isMessageReader(input) ? input : new messageReader_1.StreamMessageReader(input);
    let writer = isMessageWriter(output) ? output : new messageWriter_1.StreamMessageWriter(output);
    return _createMessageConnection(reader, writer, logger, strategy);
  }
  exports2.createMessageConnection = createMessageConnection;
});

// node_modules/vscode-languageserver-types/lib/umd/main.js
var require_main2 = __commonJS((exports2, module2) => {
  (function(factory) {
    if (typeof module2 === "object" && typeof module2.exports === "object") {
      var v = factory(require, exports2);
      if (v !== void 0)
        module2.exports = v;
    } else if (typeof define === "function" && define.amd) {
      define(["require", "exports"], factory);
    }
  })(function(require2, exports3) {
    "use strict";
    Object.defineProperty(exports3, "__esModule", {value: true});
    var Position;
    (function(Position2) {
      function create(line, character) {
        return {line, character};
      }
      Position2.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Is.number(candidate.line) && Is.number(candidate.character);
      }
      Position2.is = is;
    })(Position = exports3.Position || (exports3.Position = {}));
    var Range;
    (function(Range2) {
      function create(one, two, three, four) {
        if (Is.number(one) && Is.number(two) && Is.number(three) && Is.number(four)) {
          return {start: Position.create(one, two), end: Position.create(three, four)};
        } else if (Position.is(one) && Position.is(two)) {
          return {start: one, end: two};
        } else {
          throw new Error("Range#create called with invalid arguments[" + one + ", " + two + ", " + three + ", " + four + "]");
        }
      }
      Range2.create = create;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Position.is(candidate.start) && Position.is(candidate.end);
      }
      Range2.is = is;
    })(Range = exports3.Range || (exports3.Range = {}));
    var Location;
    (function(Location2) {
      function create(uri, range) {
        return {uri, range};
      }
      Location2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Range.is(candidate.range) && (Is.string(candidate.uri) || Is.undefined(candidate.uri));
      }
      Location2.is = is;
    })(Location = exports3.Location || (exports3.Location = {}));
    var LocationLink;
    (function(LocationLink2) {
      function create(targetUri, targetRange, targetSelectionRange, originSelectionRange) {
        return {targetUri, targetRange, targetSelectionRange, originSelectionRange};
      }
      LocationLink2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Range.is(candidate.targetRange) && Is.string(candidate.targetUri) && (Range.is(candidate.targetSelectionRange) || Is.undefined(candidate.targetSelectionRange)) && (Range.is(candidate.originSelectionRange) || Is.undefined(candidate.originSelectionRange));
      }
      LocationLink2.is = is;
    })(LocationLink = exports3.LocationLink || (exports3.LocationLink = {}));
    var Color;
    (function(Color2) {
      function create(red, green, blue, alpha) {
        return {
          red,
          green,
          blue,
          alpha
        };
      }
      Color2.create = create;
      function is(value) {
        var candidate = value;
        return Is.number(candidate.red) && Is.number(candidate.green) && Is.number(candidate.blue) && Is.number(candidate.alpha);
      }
      Color2.is = is;
    })(Color = exports3.Color || (exports3.Color = {}));
    var ColorInformation;
    (function(ColorInformation2) {
      function create(range, color) {
        return {
          range,
          color
        };
      }
      ColorInformation2.create = create;
      function is(value) {
        var candidate = value;
        return Range.is(candidate.range) && Color.is(candidate.color);
      }
      ColorInformation2.is = is;
    })(ColorInformation = exports3.ColorInformation || (exports3.ColorInformation = {}));
    var ColorPresentation;
    (function(ColorPresentation2) {
      function create(label, textEdit, additionalTextEdits) {
        return {
          label,
          textEdit,
          additionalTextEdits
        };
      }
      ColorPresentation2.create = create;
      function is(value) {
        var candidate = value;
        return Is.string(candidate.label) && (Is.undefined(candidate.textEdit) || TextEdit.is(candidate)) && (Is.undefined(candidate.additionalTextEdits) || Is.typedArray(candidate.additionalTextEdits, TextEdit.is));
      }
      ColorPresentation2.is = is;
    })(ColorPresentation = exports3.ColorPresentation || (exports3.ColorPresentation = {}));
    var FoldingRangeKind;
    (function(FoldingRangeKind2) {
      FoldingRangeKind2["Comment"] = "comment";
      FoldingRangeKind2["Imports"] = "imports";
      FoldingRangeKind2["Region"] = "region";
    })(FoldingRangeKind = exports3.FoldingRangeKind || (exports3.FoldingRangeKind = {}));
    var FoldingRange;
    (function(FoldingRange2) {
      function create(startLine, endLine, startCharacter, endCharacter, kind) {
        var result = {
          startLine,
          endLine
        };
        if (Is.defined(startCharacter)) {
          result.startCharacter = startCharacter;
        }
        if (Is.defined(endCharacter)) {
          result.endCharacter = endCharacter;
        }
        if (Is.defined(kind)) {
          result.kind = kind;
        }
        return result;
      }
      FoldingRange2.create = create;
      function is(value) {
        var candidate = value;
        return Is.number(candidate.startLine) && Is.number(candidate.startLine) && (Is.undefined(candidate.startCharacter) || Is.number(candidate.startCharacter)) && (Is.undefined(candidate.endCharacter) || Is.number(candidate.endCharacter)) && (Is.undefined(candidate.kind) || Is.string(candidate.kind));
      }
      FoldingRange2.is = is;
    })(FoldingRange = exports3.FoldingRange || (exports3.FoldingRange = {}));
    var DiagnosticRelatedInformation;
    (function(DiagnosticRelatedInformation2) {
      function create(location, message) {
        return {
          location,
          message
        };
      }
      DiagnosticRelatedInformation2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Location.is(candidate.location) && Is.string(candidate.message);
      }
      DiagnosticRelatedInformation2.is = is;
    })(DiagnosticRelatedInformation = exports3.DiagnosticRelatedInformation || (exports3.DiagnosticRelatedInformation = {}));
    var DiagnosticSeverity;
    (function(DiagnosticSeverity2) {
      DiagnosticSeverity2.Error = 1;
      DiagnosticSeverity2.Warning = 2;
      DiagnosticSeverity2.Information = 3;
      DiagnosticSeverity2.Hint = 4;
    })(DiagnosticSeverity = exports3.DiagnosticSeverity || (exports3.DiagnosticSeverity = {}));
    var DiagnosticTag;
    (function(DiagnosticTag2) {
      DiagnosticTag2.Unnecessary = 1;
      DiagnosticTag2.Deprecated = 2;
    })(DiagnosticTag = exports3.DiagnosticTag || (exports3.DiagnosticTag = {}));
    var Diagnostic;
    (function(Diagnostic2) {
      function create(range, message, severity, code, source, relatedInformation) {
        var result = {range, message};
        if (Is.defined(severity)) {
          result.severity = severity;
        }
        if (Is.defined(code)) {
          result.code = code;
        }
        if (Is.defined(source)) {
          result.source = source;
        }
        if (Is.defined(relatedInformation)) {
          result.relatedInformation = relatedInformation;
        }
        return result;
      }
      Diagnostic2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Range.is(candidate.range) && Is.string(candidate.message) && (Is.number(candidate.severity) || Is.undefined(candidate.severity)) && (Is.number(candidate.code) || Is.string(candidate.code) || Is.undefined(candidate.code)) && (Is.string(candidate.source) || Is.undefined(candidate.source)) && (Is.undefined(candidate.relatedInformation) || Is.typedArray(candidate.relatedInformation, DiagnosticRelatedInformation.is));
      }
      Diagnostic2.is = is;
    })(Diagnostic = exports3.Diagnostic || (exports3.Diagnostic = {}));
    var Command;
    (function(Command2) {
      function create(title, command) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
          args[_i - 2] = arguments[_i];
        }
        var result = {title, command};
        if (Is.defined(args) && args.length > 0) {
          result.arguments = args;
        }
        return result;
      }
      Command2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.title) && Is.string(candidate.command);
      }
      Command2.is = is;
    })(Command = exports3.Command || (exports3.Command = {}));
    var TextEdit;
    (function(TextEdit2) {
      function replace(range, newText) {
        return {range, newText};
      }
      TextEdit2.replace = replace;
      function insert(position, newText) {
        return {range: {start: position, end: position}, newText};
      }
      TextEdit2.insert = insert;
      function del(range) {
        return {range, newText: ""};
      }
      TextEdit2.del = del;
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(candidate) && Is.string(candidate.newText) && Range.is(candidate.range);
      }
      TextEdit2.is = is;
    })(TextEdit = exports3.TextEdit || (exports3.TextEdit = {}));
    var TextDocumentEdit;
    (function(TextDocumentEdit2) {
      function create(textDocument, edits) {
        return {textDocument, edits};
      }
      TextDocumentEdit2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && VersionedTextDocumentIdentifier.is(candidate.textDocument) && Array.isArray(candidate.edits);
      }
      TextDocumentEdit2.is = is;
    })(TextDocumentEdit = exports3.TextDocumentEdit || (exports3.TextDocumentEdit = {}));
    var CreateFile;
    (function(CreateFile2) {
      function create(uri, options) {
        var result = {
          kind: "create",
          uri
        };
        if (options !== void 0 && (options.overwrite !== void 0 || options.ignoreIfExists !== void 0)) {
          result.options = options;
        }
        return result;
      }
      CreateFile2.create = create;
      function is(value) {
        var candidate = value;
        return candidate && candidate.kind === "create" && Is.string(candidate.uri) && (candidate.options === void 0 || (candidate.options.overwrite === void 0 || Is.boolean(candidate.options.overwrite)) && (candidate.options.ignoreIfExists === void 0 || Is.boolean(candidate.options.ignoreIfExists)));
      }
      CreateFile2.is = is;
    })(CreateFile = exports3.CreateFile || (exports3.CreateFile = {}));
    var RenameFile;
    (function(RenameFile2) {
      function create(oldUri, newUri, options) {
        var result = {
          kind: "rename",
          oldUri,
          newUri
        };
        if (options !== void 0 && (options.overwrite !== void 0 || options.ignoreIfExists !== void 0)) {
          result.options = options;
        }
        return result;
      }
      RenameFile2.create = create;
      function is(value) {
        var candidate = value;
        return candidate && candidate.kind === "rename" && Is.string(candidate.oldUri) && Is.string(candidate.newUri) && (candidate.options === void 0 || (candidate.options.overwrite === void 0 || Is.boolean(candidate.options.overwrite)) && (candidate.options.ignoreIfExists === void 0 || Is.boolean(candidate.options.ignoreIfExists)));
      }
      RenameFile2.is = is;
    })(RenameFile = exports3.RenameFile || (exports3.RenameFile = {}));
    var DeleteFile;
    (function(DeleteFile2) {
      function create(uri, options) {
        var result = {
          kind: "delete",
          uri
        };
        if (options !== void 0 && (options.recursive !== void 0 || options.ignoreIfNotExists !== void 0)) {
          result.options = options;
        }
        return result;
      }
      DeleteFile2.create = create;
      function is(value) {
        var candidate = value;
        return candidate && candidate.kind === "delete" && Is.string(candidate.uri) && (candidate.options === void 0 || (candidate.options.recursive === void 0 || Is.boolean(candidate.options.recursive)) && (candidate.options.ignoreIfNotExists === void 0 || Is.boolean(candidate.options.ignoreIfNotExists)));
      }
      DeleteFile2.is = is;
    })(DeleteFile = exports3.DeleteFile || (exports3.DeleteFile = {}));
    var WorkspaceEdit;
    (function(WorkspaceEdit2) {
      function is(value) {
        var candidate = value;
        return candidate && (candidate.changes !== void 0 || candidate.documentChanges !== void 0) && (candidate.documentChanges === void 0 || candidate.documentChanges.every(function(change) {
          if (Is.string(change.kind)) {
            return CreateFile.is(change) || RenameFile.is(change) || DeleteFile.is(change);
          } else {
            return TextDocumentEdit.is(change);
          }
        }));
      }
      WorkspaceEdit2.is = is;
    })(WorkspaceEdit = exports3.WorkspaceEdit || (exports3.WorkspaceEdit = {}));
    var TextEditChangeImpl = function() {
      function TextEditChangeImpl2(edits) {
        this.edits = edits;
      }
      TextEditChangeImpl2.prototype.insert = function(position, newText) {
        this.edits.push(TextEdit.insert(position, newText));
      };
      TextEditChangeImpl2.prototype.replace = function(range, newText) {
        this.edits.push(TextEdit.replace(range, newText));
      };
      TextEditChangeImpl2.prototype.delete = function(range) {
        this.edits.push(TextEdit.del(range));
      };
      TextEditChangeImpl2.prototype.add = function(edit) {
        this.edits.push(edit);
      };
      TextEditChangeImpl2.prototype.all = function() {
        return this.edits;
      };
      TextEditChangeImpl2.prototype.clear = function() {
        this.edits.splice(0, this.edits.length);
      };
      return TextEditChangeImpl2;
    }();
    var WorkspaceChange = function() {
      function WorkspaceChange2(workspaceEdit) {
        var _this = this;
        this._textEditChanges = Object.create(null);
        if (workspaceEdit) {
          this._workspaceEdit = workspaceEdit;
          if (workspaceEdit.documentChanges) {
            workspaceEdit.documentChanges.forEach(function(change) {
              if (TextDocumentEdit.is(change)) {
                var textEditChange = new TextEditChangeImpl(change.edits);
                _this._textEditChanges[change.textDocument.uri] = textEditChange;
              }
            });
          } else if (workspaceEdit.changes) {
            Object.keys(workspaceEdit.changes).forEach(function(key) {
              var textEditChange = new TextEditChangeImpl(workspaceEdit.changes[key]);
              _this._textEditChanges[key] = textEditChange;
            });
          }
        }
      }
      Object.defineProperty(WorkspaceChange2.prototype, "edit", {
        get: function() {
          return this._workspaceEdit;
        },
        enumerable: true,
        configurable: true
      });
      WorkspaceChange2.prototype.getTextEditChange = function(key) {
        if (VersionedTextDocumentIdentifier.is(key)) {
          if (!this._workspaceEdit) {
            this._workspaceEdit = {
              documentChanges: []
            };
          }
          if (!this._workspaceEdit.documentChanges) {
            throw new Error("Workspace edit is not configured for document changes.");
          }
          var textDocument = key;
          var result = this._textEditChanges[textDocument.uri];
          if (!result) {
            var edits = [];
            var textDocumentEdit = {
              textDocument,
              edits
            };
            this._workspaceEdit.documentChanges.push(textDocumentEdit);
            result = new TextEditChangeImpl(edits);
            this._textEditChanges[textDocument.uri] = result;
          }
          return result;
        } else {
          if (!this._workspaceEdit) {
            this._workspaceEdit = {
              changes: Object.create(null)
            };
          }
          if (!this._workspaceEdit.changes) {
            throw new Error("Workspace edit is not configured for normal text edit changes.");
          }
          var result = this._textEditChanges[key];
          if (!result) {
            var edits = [];
            this._workspaceEdit.changes[key] = edits;
            result = new TextEditChangeImpl(edits);
            this._textEditChanges[key] = result;
          }
          return result;
        }
      };
      WorkspaceChange2.prototype.createFile = function(uri, options) {
        this.checkDocumentChanges();
        this._workspaceEdit.documentChanges.push(CreateFile.create(uri, options));
      };
      WorkspaceChange2.prototype.renameFile = function(oldUri, newUri, options) {
        this.checkDocumentChanges();
        this._workspaceEdit.documentChanges.push(RenameFile.create(oldUri, newUri, options));
      };
      WorkspaceChange2.prototype.deleteFile = function(uri, options) {
        this.checkDocumentChanges();
        this._workspaceEdit.documentChanges.push(DeleteFile.create(uri, options));
      };
      WorkspaceChange2.prototype.checkDocumentChanges = function() {
        if (!this._workspaceEdit || !this._workspaceEdit.documentChanges) {
          throw new Error("Workspace edit is not configured for document changes.");
        }
      };
      return WorkspaceChange2;
    }();
    exports3.WorkspaceChange = WorkspaceChange;
    var TextDocumentIdentifier;
    (function(TextDocumentIdentifier2) {
      function create(uri) {
        return {uri};
      }
      TextDocumentIdentifier2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.uri);
      }
      TextDocumentIdentifier2.is = is;
    })(TextDocumentIdentifier = exports3.TextDocumentIdentifier || (exports3.TextDocumentIdentifier = {}));
    var VersionedTextDocumentIdentifier;
    (function(VersionedTextDocumentIdentifier2) {
      function create(uri, version) {
        return {uri, version};
      }
      VersionedTextDocumentIdentifier2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.uri) && (candidate.version === null || Is.number(candidate.version));
      }
      VersionedTextDocumentIdentifier2.is = is;
    })(VersionedTextDocumentIdentifier = exports3.VersionedTextDocumentIdentifier || (exports3.VersionedTextDocumentIdentifier = {}));
    var TextDocumentItem;
    (function(TextDocumentItem2) {
      function create(uri, languageId, version, text) {
        return {uri, languageId, version, text};
      }
      TextDocumentItem2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.uri) && Is.string(candidate.languageId) && Is.number(candidate.version) && Is.string(candidate.text);
      }
      TextDocumentItem2.is = is;
    })(TextDocumentItem = exports3.TextDocumentItem || (exports3.TextDocumentItem = {}));
    var MarkupKind;
    (function(MarkupKind2) {
      MarkupKind2.PlainText = "plaintext";
      MarkupKind2.Markdown = "markdown";
    })(MarkupKind = exports3.MarkupKind || (exports3.MarkupKind = {}));
    (function(MarkupKind2) {
      function is(value) {
        var candidate = value;
        return candidate === MarkupKind2.PlainText || candidate === MarkupKind2.Markdown;
      }
      MarkupKind2.is = is;
    })(MarkupKind = exports3.MarkupKind || (exports3.MarkupKind = {}));
    var MarkupContent;
    (function(MarkupContent2) {
      function is(value) {
        var candidate = value;
        return Is.objectLiteral(value) && MarkupKind.is(candidate.kind) && Is.string(candidate.value);
      }
      MarkupContent2.is = is;
    })(MarkupContent = exports3.MarkupContent || (exports3.MarkupContent = {}));
    var CompletionItemKind;
    (function(CompletionItemKind2) {
      CompletionItemKind2.Text = 1;
      CompletionItemKind2.Method = 2;
      CompletionItemKind2.Function = 3;
      CompletionItemKind2.Constructor = 4;
      CompletionItemKind2.Field = 5;
      CompletionItemKind2.Variable = 6;
      CompletionItemKind2.Class = 7;
      CompletionItemKind2.Interface = 8;
      CompletionItemKind2.Module = 9;
      CompletionItemKind2.Property = 10;
      CompletionItemKind2.Unit = 11;
      CompletionItemKind2.Value = 12;
      CompletionItemKind2.Enum = 13;
      CompletionItemKind2.Keyword = 14;
      CompletionItemKind2.Snippet = 15;
      CompletionItemKind2.Color = 16;
      CompletionItemKind2.File = 17;
      CompletionItemKind2.Reference = 18;
      CompletionItemKind2.Folder = 19;
      CompletionItemKind2.EnumMember = 20;
      CompletionItemKind2.Constant = 21;
      CompletionItemKind2.Struct = 22;
      CompletionItemKind2.Event = 23;
      CompletionItemKind2.Operator = 24;
      CompletionItemKind2.TypeParameter = 25;
    })(CompletionItemKind = exports3.CompletionItemKind || (exports3.CompletionItemKind = {}));
    var InsertTextFormat;
    (function(InsertTextFormat2) {
      InsertTextFormat2.PlainText = 1;
      InsertTextFormat2.Snippet = 2;
    })(InsertTextFormat = exports3.InsertTextFormat || (exports3.InsertTextFormat = {}));
    var CompletionItemTag;
    (function(CompletionItemTag2) {
      CompletionItemTag2.Deprecated = 1;
    })(CompletionItemTag = exports3.CompletionItemTag || (exports3.CompletionItemTag = {}));
    var CompletionItem;
    (function(CompletionItem2) {
      function create(label) {
        return {label};
      }
      CompletionItem2.create = create;
    })(CompletionItem = exports3.CompletionItem || (exports3.CompletionItem = {}));
    var CompletionList;
    (function(CompletionList2) {
      function create(items, isIncomplete) {
        return {items: items ? items : [], isIncomplete: !!isIncomplete};
      }
      CompletionList2.create = create;
    })(CompletionList = exports3.CompletionList || (exports3.CompletionList = {}));
    var MarkedString;
    (function(MarkedString2) {
      function fromPlainText(plainText) {
        return plainText.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
      }
      MarkedString2.fromPlainText = fromPlainText;
      function is(value) {
        var candidate = value;
        return Is.string(candidate) || Is.objectLiteral(candidate) && Is.string(candidate.language) && Is.string(candidate.value);
      }
      MarkedString2.is = is;
    })(MarkedString = exports3.MarkedString || (exports3.MarkedString = {}));
    var Hover;
    (function(Hover2) {
      function is(value) {
        var candidate = value;
        return !!candidate && Is.objectLiteral(candidate) && (MarkupContent.is(candidate.contents) || MarkedString.is(candidate.contents) || Is.typedArray(candidate.contents, MarkedString.is)) && (value.range === void 0 || Range.is(value.range));
      }
      Hover2.is = is;
    })(Hover = exports3.Hover || (exports3.Hover = {}));
    var ParameterInformation;
    (function(ParameterInformation2) {
      function create(label, documentation) {
        return documentation ? {label, documentation} : {label};
      }
      ParameterInformation2.create = create;
    })(ParameterInformation = exports3.ParameterInformation || (exports3.ParameterInformation = {}));
    var SignatureInformation;
    (function(SignatureInformation2) {
      function create(label, documentation) {
        var parameters = [];
        for (var _i = 2; _i < arguments.length; _i++) {
          parameters[_i - 2] = arguments[_i];
        }
        var result = {label};
        if (Is.defined(documentation)) {
          result.documentation = documentation;
        }
        if (Is.defined(parameters)) {
          result.parameters = parameters;
        } else {
          result.parameters = [];
        }
        return result;
      }
      SignatureInformation2.create = create;
    })(SignatureInformation = exports3.SignatureInformation || (exports3.SignatureInformation = {}));
    var DocumentHighlightKind;
    (function(DocumentHighlightKind2) {
      DocumentHighlightKind2.Text = 1;
      DocumentHighlightKind2.Read = 2;
      DocumentHighlightKind2.Write = 3;
    })(DocumentHighlightKind = exports3.DocumentHighlightKind || (exports3.DocumentHighlightKind = {}));
    var DocumentHighlight;
    (function(DocumentHighlight2) {
      function create(range, kind) {
        var result = {range};
        if (Is.number(kind)) {
          result.kind = kind;
        }
        return result;
      }
      DocumentHighlight2.create = create;
    })(DocumentHighlight = exports3.DocumentHighlight || (exports3.DocumentHighlight = {}));
    var SymbolKind;
    (function(SymbolKind2) {
      SymbolKind2.File = 1;
      SymbolKind2.Module = 2;
      SymbolKind2.Namespace = 3;
      SymbolKind2.Package = 4;
      SymbolKind2.Class = 5;
      SymbolKind2.Method = 6;
      SymbolKind2.Property = 7;
      SymbolKind2.Field = 8;
      SymbolKind2.Constructor = 9;
      SymbolKind2.Enum = 10;
      SymbolKind2.Interface = 11;
      SymbolKind2.Function = 12;
      SymbolKind2.Variable = 13;
      SymbolKind2.Constant = 14;
      SymbolKind2.String = 15;
      SymbolKind2.Number = 16;
      SymbolKind2.Boolean = 17;
      SymbolKind2.Array = 18;
      SymbolKind2.Object = 19;
      SymbolKind2.Key = 20;
      SymbolKind2.Null = 21;
      SymbolKind2.EnumMember = 22;
      SymbolKind2.Struct = 23;
      SymbolKind2.Event = 24;
      SymbolKind2.Operator = 25;
      SymbolKind2.TypeParameter = 26;
    })(SymbolKind = exports3.SymbolKind || (exports3.SymbolKind = {}));
    var SymbolTag;
    (function(SymbolTag2) {
      SymbolTag2.Deprecated = 1;
    })(SymbolTag = exports3.SymbolTag || (exports3.SymbolTag = {}));
    var SymbolInformation;
    (function(SymbolInformation2) {
      function create(name, kind, range, uri, containerName) {
        var result = {
          name,
          kind,
          location: {uri, range}
        };
        if (containerName) {
          result.containerName = containerName;
        }
        return result;
      }
      SymbolInformation2.create = create;
    })(SymbolInformation = exports3.SymbolInformation || (exports3.SymbolInformation = {}));
    var DocumentSymbol;
    (function(DocumentSymbol2) {
      function create(name, detail, kind, range, selectionRange, children) {
        var result = {
          name,
          detail,
          kind,
          range,
          selectionRange
        };
        if (children !== void 0) {
          result.children = children;
        }
        return result;
      }
      DocumentSymbol2.create = create;
      function is(value) {
        var candidate = value;
        return candidate && Is.string(candidate.name) && Is.number(candidate.kind) && Range.is(candidate.range) && Range.is(candidate.selectionRange) && (candidate.detail === void 0 || Is.string(candidate.detail)) && (candidate.deprecated === void 0 || Is.boolean(candidate.deprecated)) && (candidate.children === void 0 || Array.isArray(candidate.children));
      }
      DocumentSymbol2.is = is;
    })(DocumentSymbol = exports3.DocumentSymbol || (exports3.DocumentSymbol = {}));
    var CodeActionKind;
    (function(CodeActionKind2) {
      CodeActionKind2.Empty = "";
      CodeActionKind2.QuickFix = "quickfix";
      CodeActionKind2.Refactor = "refactor";
      CodeActionKind2.RefactorExtract = "refactor.extract";
      CodeActionKind2.RefactorInline = "refactor.inline";
      CodeActionKind2.RefactorRewrite = "refactor.rewrite";
      CodeActionKind2.Source = "source";
      CodeActionKind2.SourceOrganizeImports = "source.organizeImports";
      CodeActionKind2.SourceFixAll = "source.fixAll";
    })(CodeActionKind = exports3.CodeActionKind || (exports3.CodeActionKind = {}));
    var CodeActionContext;
    (function(CodeActionContext2) {
      function create(diagnostics, only) {
        var result = {diagnostics};
        if (only !== void 0 && only !== null) {
          result.only = only;
        }
        return result;
      }
      CodeActionContext2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.typedArray(candidate.diagnostics, Diagnostic.is) && (candidate.only === void 0 || Is.typedArray(candidate.only, Is.string));
      }
      CodeActionContext2.is = is;
    })(CodeActionContext = exports3.CodeActionContext || (exports3.CodeActionContext = {}));
    var CodeAction;
    (function(CodeAction2) {
      function create(title, commandOrEdit, kind) {
        var result = {title};
        if (Command.is(commandOrEdit)) {
          result.command = commandOrEdit;
        } else {
          result.edit = commandOrEdit;
        }
        if (kind !== void 0) {
          result.kind = kind;
        }
        return result;
      }
      CodeAction2.create = create;
      function is(value) {
        var candidate = value;
        return candidate && Is.string(candidate.title) && (candidate.diagnostics === void 0 || Is.typedArray(candidate.diagnostics, Diagnostic.is)) && (candidate.kind === void 0 || Is.string(candidate.kind)) && (candidate.edit !== void 0 || candidate.command !== void 0) && (candidate.command === void 0 || Command.is(candidate.command)) && (candidate.isPreferred === void 0 || Is.boolean(candidate.isPreferred)) && (candidate.edit === void 0 || WorkspaceEdit.is(candidate.edit));
      }
      CodeAction2.is = is;
    })(CodeAction = exports3.CodeAction || (exports3.CodeAction = {}));
    var CodeLens;
    (function(CodeLens2) {
      function create(range, data) {
        var result = {range};
        if (Is.defined(data)) {
          result.data = data;
        }
        return result;
      }
      CodeLens2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Range.is(candidate.range) && (Is.undefined(candidate.command) || Command.is(candidate.command));
      }
      CodeLens2.is = is;
    })(CodeLens = exports3.CodeLens || (exports3.CodeLens = {}));
    var FormattingOptions;
    (function(FormattingOptions2) {
      function create(tabSize, insertSpaces) {
        return {tabSize, insertSpaces};
      }
      FormattingOptions2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.number(candidate.tabSize) && Is.boolean(candidate.insertSpaces);
      }
      FormattingOptions2.is = is;
    })(FormattingOptions = exports3.FormattingOptions || (exports3.FormattingOptions = {}));
    var DocumentLink;
    (function(DocumentLink2) {
      function create(range, target, data) {
        return {range, target, data};
      }
      DocumentLink2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Range.is(candidate.range) && (Is.undefined(candidate.target) || Is.string(candidate.target));
      }
      DocumentLink2.is = is;
    })(DocumentLink = exports3.DocumentLink || (exports3.DocumentLink = {}));
    var SelectionRange;
    (function(SelectionRange2) {
      function create(range, parent) {
        return {range, parent};
      }
      SelectionRange2.create = create;
      function is(value) {
        var candidate = value;
        return candidate !== void 0 && Range.is(candidate.range) && (candidate.parent === void 0 || SelectionRange2.is(candidate.parent));
      }
      SelectionRange2.is = is;
    })(SelectionRange = exports3.SelectionRange || (exports3.SelectionRange = {}));
    exports3.EOL = ["\n", "\r\n", "\r"];
    var TextDocument;
    (function(TextDocument2) {
      function create(uri, languageId, version, content) {
        return new FullTextDocument(uri, languageId, version, content);
      }
      TextDocument2.create = create;
      function is(value) {
        var candidate = value;
        return Is.defined(candidate) && Is.string(candidate.uri) && (Is.undefined(candidate.languageId) || Is.string(candidate.languageId)) && Is.number(candidate.lineCount) && Is.func(candidate.getText) && Is.func(candidate.positionAt) && Is.func(candidate.offsetAt) ? true : false;
      }
      TextDocument2.is = is;
      function applyEdits(document, edits) {
        var text = document.getText();
        var sortedEdits = mergeSort(edits, function(a, b) {
          var diff = a.range.start.line - b.range.start.line;
          if (diff === 0) {
            return a.range.start.character - b.range.start.character;
          }
          return diff;
        });
        var lastModifiedOffset = text.length;
        for (var i = sortedEdits.length - 1; i >= 0; i--) {
          var e = sortedEdits[i];
          var startOffset = document.offsetAt(e.range.start);
          var endOffset = document.offsetAt(e.range.end);
          if (endOffset <= lastModifiedOffset) {
            text = text.substring(0, startOffset) + e.newText + text.substring(endOffset, text.length);
          } else {
            throw new Error("Overlapping edit");
          }
          lastModifiedOffset = startOffset;
        }
        return text;
      }
      TextDocument2.applyEdits = applyEdits;
      function mergeSort(data, compare) {
        if (data.length <= 1) {
          return data;
        }
        var p = data.length / 2 | 0;
        var left = data.slice(0, p);
        var right = data.slice(p);
        mergeSort(left, compare);
        mergeSort(right, compare);
        var leftIdx = 0;
        var rightIdx = 0;
        var i = 0;
        while (leftIdx < left.length && rightIdx < right.length) {
          var ret = compare(left[leftIdx], right[rightIdx]);
          if (ret <= 0) {
            data[i++] = left[leftIdx++];
          } else {
            data[i++] = right[rightIdx++];
          }
        }
        while (leftIdx < left.length) {
          data[i++] = left[leftIdx++];
        }
        while (rightIdx < right.length) {
          data[i++] = right[rightIdx++];
        }
        return data;
      }
    })(TextDocument = exports3.TextDocument || (exports3.TextDocument = {}));
    var FullTextDocument = function() {
      function FullTextDocument2(uri, languageId, version, content) {
        this._uri = uri;
        this._languageId = languageId;
        this._version = version;
        this._content = content;
        this._lineOffsets = void 0;
      }
      Object.defineProperty(FullTextDocument2.prototype, "uri", {
        get: function() {
          return this._uri;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(FullTextDocument2.prototype, "languageId", {
        get: function() {
          return this._languageId;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(FullTextDocument2.prototype, "version", {
        get: function() {
          return this._version;
        },
        enumerable: true,
        configurable: true
      });
      FullTextDocument2.prototype.getText = function(range) {
        if (range) {
          var start = this.offsetAt(range.start);
          var end = this.offsetAt(range.end);
          return this._content.substring(start, end);
        }
        return this._content;
      };
      FullTextDocument2.prototype.update = function(event, version) {
        this._content = event.text;
        this._version = version;
        this._lineOffsets = void 0;
      };
      FullTextDocument2.prototype.getLineOffsets = function() {
        if (this._lineOffsets === void 0) {
          var lineOffsets = [];
          var text = this._content;
          var isLineStart = true;
          for (var i = 0; i < text.length; i++) {
            if (isLineStart) {
              lineOffsets.push(i);
              isLineStart = false;
            }
            var ch = text.charAt(i);
            isLineStart = ch === "\r" || ch === "\n";
            if (ch === "\r" && i + 1 < text.length && text.charAt(i + 1) === "\n") {
              i++;
            }
          }
          if (isLineStart && text.length > 0) {
            lineOffsets.push(text.length);
          }
          this._lineOffsets = lineOffsets;
        }
        return this._lineOffsets;
      };
      FullTextDocument2.prototype.positionAt = function(offset) {
        offset = Math.max(Math.min(offset, this._content.length), 0);
        var lineOffsets = this.getLineOffsets();
        var low = 0, high = lineOffsets.length;
        if (high === 0) {
          return Position.create(0, offset);
        }
        while (low < high) {
          var mid = Math.floor((low + high) / 2);
          if (lineOffsets[mid] > offset) {
            high = mid;
          } else {
            low = mid + 1;
          }
        }
        var line = low - 1;
        return Position.create(line, offset - lineOffsets[line]);
      };
      FullTextDocument2.prototype.offsetAt = function(position) {
        var lineOffsets = this.getLineOffsets();
        if (position.line >= lineOffsets.length) {
          return this._content.length;
        } else if (position.line < 0) {
          return 0;
        }
        var lineOffset = lineOffsets[position.line];
        var nextLineOffset = position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : this._content.length;
        return Math.max(Math.min(lineOffset + position.character, nextLineOffset), lineOffset);
      };
      Object.defineProperty(FullTextDocument2.prototype, "lineCount", {
        get: function() {
          return this.getLineOffsets().length;
        },
        enumerable: true,
        configurable: true
      });
      return FullTextDocument2;
    }();
    var Is;
    (function(Is2) {
      var toString = Object.prototype.toString;
      function defined(value) {
        return typeof value !== "undefined";
      }
      Is2.defined = defined;
      function undefined2(value) {
        return typeof value === "undefined";
      }
      Is2.undefined = undefined2;
      function boolean(value) {
        return value === true || value === false;
      }
      Is2.boolean = boolean;
      function string(value) {
        return toString.call(value) === "[object String]";
      }
      Is2.string = string;
      function number(value) {
        return toString.call(value) === "[object Number]";
      }
      Is2.number = number;
      function func(value) {
        return toString.call(value) === "[object Function]";
      }
      Is2.func = func;
      function objectLiteral(value) {
        return value !== null && typeof value === "object";
      }
      Is2.objectLiteral = objectLiteral;
      function typedArray(value, check) {
        return Array.isArray(value) && value.every(check);
      }
      Is2.typedArray = typedArray;
    })(Is || (Is = {}));
  });
});

// node_modules/vscode-languageserver-protocol/lib/utils/is.js
var require_is2 = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  function boolean(value) {
    return value === true || value === false;
  }
  exports2.boolean = boolean;
  function string(value) {
    return typeof value === "string" || value instanceof String;
  }
  exports2.string = string;
  function number(value) {
    return typeof value === "number" || value instanceof Number;
  }
  exports2.number = number;
  function error(value) {
    return value instanceof Error;
  }
  exports2.error = error;
  function func(value) {
    return typeof value === "function";
  }
  exports2.func = func;
  function array(value) {
    return Array.isArray(value);
  }
  exports2.array = array;
  function stringArray(value) {
    return array(value) && value.every((elem) => string(elem));
  }
  exports2.stringArray = stringArray;
  function typedArray(value, check) {
    return Array.isArray(value) && value.every(check);
  }
  exports2.typedArray = typedArray;
  function objectLiteral(value) {
    return value !== null && typeof value === "object";
  }
  exports2.objectLiteral = objectLiteral;
});

// node_modules/vscode-languageserver-protocol/lib/messages.js
var require_messages2 = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_jsonrpc_1 = require_main();
  var ProtocolRequestType0 = class extends vscode_jsonrpc_1.RequestType0 {
    constructor(method) {
      super(method);
    }
  };
  exports2.ProtocolRequestType0 = ProtocolRequestType0;
  var ProtocolRequestType = class extends vscode_jsonrpc_1.RequestType {
    constructor(method) {
      super(method);
    }
  };
  exports2.ProtocolRequestType = ProtocolRequestType;
  var ProtocolNotificationType = class extends vscode_jsonrpc_1.NotificationType {
    constructor(method) {
      super(method);
    }
  };
  exports2.ProtocolNotificationType = ProtocolNotificationType;
  var ProtocolNotificationType0 = class extends vscode_jsonrpc_1.NotificationType0 {
    constructor(method) {
      super(method);
    }
  };
  exports2.ProtocolNotificationType0 = ProtocolNotificationType0;
});

// node_modules/vscode-languageserver-protocol/lib/protocol.implementation.js
var require_protocol_implementation = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_jsonrpc_1 = require_main();
  var messages_1 = require_messages2();
  var ImplementationRequest;
  (function(ImplementationRequest2) {
    ImplementationRequest2.method = "textDocument/implementation";
    ImplementationRequest2.type = new messages_1.ProtocolRequestType(ImplementationRequest2.method);
    ImplementationRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(ImplementationRequest = exports2.ImplementationRequest || (exports2.ImplementationRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.typeDefinition.js
var require_protocol_typeDefinition = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_jsonrpc_1 = require_main();
  var messages_1 = require_messages2();
  var TypeDefinitionRequest;
  (function(TypeDefinitionRequest2) {
    TypeDefinitionRequest2.method = "textDocument/typeDefinition";
    TypeDefinitionRequest2.type = new messages_1.ProtocolRequestType(TypeDefinitionRequest2.method);
    TypeDefinitionRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(TypeDefinitionRequest = exports2.TypeDefinitionRequest || (exports2.TypeDefinitionRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.workspaceFolders.js
var require_protocol_workspaceFolders = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var messages_1 = require_messages2();
  var WorkspaceFoldersRequest;
  (function(WorkspaceFoldersRequest2) {
    WorkspaceFoldersRequest2.type = new messages_1.ProtocolRequestType0("workspace/workspaceFolders");
  })(WorkspaceFoldersRequest = exports2.WorkspaceFoldersRequest || (exports2.WorkspaceFoldersRequest = {}));
  var DidChangeWorkspaceFoldersNotification;
  (function(DidChangeWorkspaceFoldersNotification2) {
    DidChangeWorkspaceFoldersNotification2.type = new messages_1.ProtocolNotificationType("workspace/didChangeWorkspaceFolders");
  })(DidChangeWorkspaceFoldersNotification = exports2.DidChangeWorkspaceFoldersNotification || (exports2.DidChangeWorkspaceFoldersNotification = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.configuration.js
var require_protocol_configuration = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var messages_1 = require_messages2();
  var ConfigurationRequest;
  (function(ConfigurationRequest2) {
    ConfigurationRequest2.type = new messages_1.ProtocolRequestType("workspace/configuration");
  })(ConfigurationRequest = exports2.ConfigurationRequest || (exports2.ConfigurationRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.colorProvider.js
var require_protocol_colorProvider = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_jsonrpc_1 = require_main();
  var messages_1 = require_messages2();
  var DocumentColorRequest;
  (function(DocumentColorRequest2) {
    DocumentColorRequest2.method = "textDocument/documentColor";
    DocumentColorRequest2.type = new messages_1.ProtocolRequestType(DocumentColorRequest2.method);
    DocumentColorRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(DocumentColorRequest = exports2.DocumentColorRequest || (exports2.DocumentColorRequest = {}));
  var ColorPresentationRequest;
  (function(ColorPresentationRequest2) {
    ColorPresentationRequest2.type = new messages_1.ProtocolRequestType("textDocument/colorPresentation");
  })(ColorPresentationRequest = exports2.ColorPresentationRequest || (exports2.ColorPresentationRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.foldingRange.js
var require_protocol_foldingRange = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_jsonrpc_1 = require_main();
  var messages_1 = require_messages2();
  var FoldingRangeKind;
  (function(FoldingRangeKind2) {
    FoldingRangeKind2["Comment"] = "comment";
    FoldingRangeKind2["Imports"] = "imports";
    FoldingRangeKind2["Region"] = "region";
  })(FoldingRangeKind = exports2.FoldingRangeKind || (exports2.FoldingRangeKind = {}));
  var FoldingRangeRequest;
  (function(FoldingRangeRequest2) {
    FoldingRangeRequest2.method = "textDocument/foldingRange";
    FoldingRangeRequest2.type = new messages_1.ProtocolRequestType(FoldingRangeRequest2.method);
    FoldingRangeRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(FoldingRangeRequest = exports2.FoldingRangeRequest || (exports2.FoldingRangeRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.declaration.js
var require_protocol_declaration = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_jsonrpc_1 = require_main();
  var messages_1 = require_messages2();
  var DeclarationRequest;
  (function(DeclarationRequest2) {
    DeclarationRequest2.method = "textDocument/declaration";
    DeclarationRequest2.type = new messages_1.ProtocolRequestType(DeclarationRequest2.method);
    DeclarationRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(DeclarationRequest = exports2.DeclarationRequest || (exports2.DeclarationRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.selectionRange.js
var require_protocol_selectionRange = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_jsonrpc_1 = require_main();
  var messages_1 = require_messages2();
  var SelectionRangeRequest;
  (function(SelectionRangeRequest2) {
    SelectionRangeRequest2.method = "textDocument/selectionRange";
    SelectionRangeRequest2.type = new messages_1.ProtocolRequestType(SelectionRangeRequest2.method);
    SelectionRangeRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(SelectionRangeRequest = exports2.SelectionRangeRequest || (exports2.SelectionRangeRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.progress.js
var require_protocol_progress = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_jsonrpc_1 = require_main();
  var messages_1 = require_messages2();
  var WorkDoneProgress;
  (function(WorkDoneProgress2) {
    WorkDoneProgress2.type = new vscode_jsonrpc_1.ProgressType();
  })(WorkDoneProgress = exports2.WorkDoneProgress || (exports2.WorkDoneProgress = {}));
  var WorkDoneProgressCreateRequest;
  (function(WorkDoneProgressCreateRequest2) {
    WorkDoneProgressCreateRequest2.type = new messages_1.ProtocolRequestType("window/workDoneProgress/create");
  })(WorkDoneProgressCreateRequest = exports2.WorkDoneProgressCreateRequest || (exports2.WorkDoneProgressCreateRequest = {}));
  var WorkDoneProgressCancelNotification;
  (function(WorkDoneProgressCancelNotification2) {
    WorkDoneProgressCancelNotification2.type = new messages_1.ProtocolNotificationType("window/workDoneProgress/cancel");
  })(WorkDoneProgressCancelNotification = exports2.WorkDoneProgressCancelNotification || (exports2.WorkDoneProgressCancelNotification = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.js
var require_protocol = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var Is = require_is2();
  var vscode_jsonrpc_1 = require_main();
  var messages_1 = require_messages2();
  var protocol_implementation_1 = require_protocol_implementation();
  exports2.ImplementationRequest = protocol_implementation_1.ImplementationRequest;
  var protocol_typeDefinition_1 = require_protocol_typeDefinition();
  exports2.TypeDefinitionRequest = protocol_typeDefinition_1.TypeDefinitionRequest;
  var protocol_workspaceFolders_1 = require_protocol_workspaceFolders();
  exports2.WorkspaceFoldersRequest = protocol_workspaceFolders_1.WorkspaceFoldersRequest;
  exports2.DidChangeWorkspaceFoldersNotification = protocol_workspaceFolders_1.DidChangeWorkspaceFoldersNotification;
  var protocol_configuration_1 = require_protocol_configuration();
  exports2.ConfigurationRequest = protocol_configuration_1.ConfigurationRequest;
  var protocol_colorProvider_1 = require_protocol_colorProvider();
  exports2.DocumentColorRequest = protocol_colorProvider_1.DocumentColorRequest;
  exports2.ColorPresentationRequest = protocol_colorProvider_1.ColorPresentationRequest;
  var protocol_foldingRange_1 = require_protocol_foldingRange();
  exports2.FoldingRangeRequest = protocol_foldingRange_1.FoldingRangeRequest;
  var protocol_declaration_1 = require_protocol_declaration();
  exports2.DeclarationRequest = protocol_declaration_1.DeclarationRequest;
  var protocol_selectionRange_1 = require_protocol_selectionRange();
  exports2.SelectionRangeRequest = protocol_selectionRange_1.SelectionRangeRequest;
  var protocol_progress_1 = require_protocol_progress();
  exports2.WorkDoneProgress = protocol_progress_1.WorkDoneProgress;
  exports2.WorkDoneProgressCreateRequest = protocol_progress_1.WorkDoneProgressCreateRequest;
  exports2.WorkDoneProgressCancelNotification = protocol_progress_1.WorkDoneProgressCancelNotification;
  var DocumentFilter;
  (function(DocumentFilter2) {
    function is(value) {
      const candidate = value;
      return Is.string(candidate.language) || Is.string(candidate.scheme) || Is.string(candidate.pattern);
    }
    DocumentFilter2.is = is;
  })(DocumentFilter = exports2.DocumentFilter || (exports2.DocumentFilter = {}));
  var DocumentSelector;
  (function(DocumentSelector2) {
    function is(value) {
      if (!Array.isArray(value)) {
        return false;
      }
      for (let elem of value) {
        if (!Is.string(elem) && !DocumentFilter.is(elem)) {
          return false;
        }
      }
      return true;
    }
    DocumentSelector2.is = is;
  })(DocumentSelector = exports2.DocumentSelector || (exports2.DocumentSelector = {}));
  var RegistrationRequest;
  (function(RegistrationRequest2) {
    RegistrationRequest2.type = new messages_1.ProtocolRequestType("client/registerCapability");
  })(RegistrationRequest = exports2.RegistrationRequest || (exports2.RegistrationRequest = {}));
  var UnregistrationRequest;
  (function(UnregistrationRequest2) {
    UnregistrationRequest2.type = new messages_1.ProtocolRequestType("client/unregisterCapability");
  })(UnregistrationRequest = exports2.UnregistrationRequest || (exports2.UnregistrationRequest = {}));
  var ResourceOperationKind;
  (function(ResourceOperationKind2) {
    ResourceOperationKind2.Create = "create";
    ResourceOperationKind2.Rename = "rename";
    ResourceOperationKind2.Delete = "delete";
  })(ResourceOperationKind = exports2.ResourceOperationKind || (exports2.ResourceOperationKind = {}));
  var FailureHandlingKind;
  (function(FailureHandlingKind2) {
    FailureHandlingKind2.Abort = "abort";
    FailureHandlingKind2.Transactional = "transactional";
    FailureHandlingKind2.TextOnlyTransactional = "textOnlyTransactional";
    FailureHandlingKind2.Undo = "undo";
  })(FailureHandlingKind = exports2.FailureHandlingKind || (exports2.FailureHandlingKind = {}));
  var StaticRegistrationOptions;
  (function(StaticRegistrationOptions2) {
    function hasId(value) {
      const candidate = value;
      return candidate && Is.string(candidate.id) && candidate.id.length > 0;
    }
    StaticRegistrationOptions2.hasId = hasId;
  })(StaticRegistrationOptions = exports2.StaticRegistrationOptions || (exports2.StaticRegistrationOptions = {}));
  var TextDocumentRegistrationOptions;
  (function(TextDocumentRegistrationOptions2) {
    function is(value) {
      const candidate = value;
      return candidate && (candidate.documentSelector === null || DocumentSelector.is(candidate.documentSelector));
    }
    TextDocumentRegistrationOptions2.is = is;
  })(TextDocumentRegistrationOptions = exports2.TextDocumentRegistrationOptions || (exports2.TextDocumentRegistrationOptions = {}));
  var WorkDoneProgressOptions;
  (function(WorkDoneProgressOptions2) {
    function is(value) {
      const candidate = value;
      return Is.objectLiteral(candidate) && (candidate.workDoneProgress === void 0 || Is.boolean(candidate.workDoneProgress));
    }
    WorkDoneProgressOptions2.is = is;
    function hasWorkDoneProgress(value) {
      const candidate = value;
      return candidate && Is.boolean(candidate.workDoneProgress);
    }
    WorkDoneProgressOptions2.hasWorkDoneProgress = hasWorkDoneProgress;
  })(WorkDoneProgressOptions = exports2.WorkDoneProgressOptions || (exports2.WorkDoneProgressOptions = {}));
  var InitializeRequest;
  (function(InitializeRequest2) {
    InitializeRequest2.type = new messages_1.ProtocolRequestType("initialize");
  })(InitializeRequest = exports2.InitializeRequest || (exports2.InitializeRequest = {}));
  var InitializeError;
  (function(InitializeError2) {
    InitializeError2.unknownProtocolVersion = 1;
  })(InitializeError = exports2.InitializeError || (exports2.InitializeError = {}));
  var InitializedNotification;
  (function(InitializedNotification2) {
    InitializedNotification2.type = new messages_1.ProtocolNotificationType("initialized");
  })(InitializedNotification = exports2.InitializedNotification || (exports2.InitializedNotification = {}));
  var ShutdownRequest;
  (function(ShutdownRequest2) {
    ShutdownRequest2.type = new messages_1.ProtocolRequestType0("shutdown");
  })(ShutdownRequest = exports2.ShutdownRequest || (exports2.ShutdownRequest = {}));
  var ExitNotification;
  (function(ExitNotification2) {
    ExitNotification2.type = new messages_1.ProtocolNotificationType0("exit");
  })(ExitNotification = exports2.ExitNotification || (exports2.ExitNotification = {}));
  var DidChangeConfigurationNotification;
  (function(DidChangeConfigurationNotification2) {
    DidChangeConfigurationNotification2.type = new messages_1.ProtocolNotificationType("workspace/didChangeConfiguration");
  })(DidChangeConfigurationNotification = exports2.DidChangeConfigurationNotification || (exports2.DidChangeConfigurationNotification = {}));
  var MessageType;
  (function(MessageType2) {
    MessageType2.Error = 1;
    MessageType2.Warning = 2;
    MessageType2.Info = 3;
    MessageType2.Log = 4;
  })(MessageType = exports2.MessageType || (exports2.MessageType = {}));
  var ShowMessageNotification;
  (function(ShowMessageNotification2) {
    ShowMessageNotification2.type = new messages_1.ProtocolNotificationType("window/showMessage");
  })(ShowMessageNotification = exports2.ShowMessageNotification || (exports2.ShowMessageNotification = {}));
  var ShowMessageRequest;
  (function(ShowMessageRequest2) {
    ShowMessageRequest2.type = new messages_1.ProtocolRequestType("window/showMessageRequest");
  })(ShowMessageRequest = exports2.ShowMessageRequest || (exports2.ShowMessageRequest = {}));
  var LogMessageNotification;
  (function(LogMessageNotification2) {
    LogMessageNotification2.type = new messages_1.ProtocolNotificationType("window/logMessage");
  })(LogMessageNotification = exports2.LogMessageNotification || (exports2.LogMessageNotification = {}));
  var TelemetryEventNotification;
  (function(TelemetryEventNotification2) {
    TelemetryEventNotification2.type = new messages_1.ProtocolNotificationType("telemetry/event");
  })(TelemetryEventNotification = exports2.TelemetryEventNotification || (exports2.TelemetryEventNotification = {}));
  var TextDocumentSyncKind;
  (function(TextDocumentSyncKind2) {
    TextDocumentSyncKind2.None = 0;
    TextDocumentSyncKind2.Full = 1;
    TextDocumentSyncKind2.Incremental = 2;
  })(TextDocumentSyncKind = exports2.TextDocumentSyncKind || (exports2.TextDocumentSyncKind = {}));
  var DidOpenTextDocumentNotification;
  (function(DidOpenTextDocumentNotification2) {
    DidOpenTextDocumentNotification2.method = "textDocument/didOpen";
    DidOpenTextDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidOpenTextDocumentNotification2.method);
  })(DidOpenTextDocumentNotification = exports2.DidOpenTextDocumentNotification || (exports2.DidOpenTextDocumentNotification = {}));
  var DidChangeTextDocumentNotification;
  (function(DidChangeTextDocumentNotification2) {
    DidChangeTextDocumentNotification2.method = "textDocument/didChange";
    DidChangeTextDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidChangeTextDocumentNotification2.method);
  })(DidChangeTextDocumentNotification = exports2.DidChangeTextDocumentNotification || (exports2.DidChangeTextDocumentNotification = {}));
  var DidCloseTextDocumentNotification;
  (function(DidCloseTextDocumentNotification2) {
    DidCloseTextDocumentNotification2.method = "textDocument/didClose";
    DidCloseTextDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidCloseTextDocumentNotification2.method);
  })(DidCloseTextDocumentNotification = exports2.DidCloseTextDocumentNotification || (exports2.DidCloseTextDocumentNotification = {}));
  var DidSaveTextDocumentNotification;
  (function(DidSaveTextDocumentNotification2) {
    DidSaveTextDocumentNotification2.method = "textDocument/didSave";
    DidSaveTextDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidSaveTextDocumentNotification2.method);
  })(DidSaveTextDocumentNotification = exports2.DidSaveTextDocumentNotification || (exports2.DidSaveTextDocumentNotification = {}));
  var TextDocumentSaveReason;
  (function(TextDocumentSaveReason2) {
    TextDocumentSaveReason2.Manual = 1;
    TextDocumentSaveReason2.AfterDelay = 2;
    TextDocumentSaveReason2.FocusOut = 3;
  })(TextDocumentSaveReason = exports2.TextDocumentSaveReason || (exports2.TextDocumentSaveReason = {}));
  var WillSaveTextDocumentNotification;
  (function(WillSaveTextDocumentNotification2) {
    WillSaveTextDocumentNotification2.method = "textDocument/willSave";
    WillSaveTextDocumentNotification2.type = new messages_1.ProtocolNotificationType(WillSaveTextDocumentNotification2.method);
  })(WillSaveTextDocumentNotification = exports2.WillSaveTextDocumentNotification || (exports2.WillSaveTextDocumentNotification = {}));
  var WillSaveTextDocumentWaitUntilRequest;
  (function(WillSaveTextDocumentWaitUntilRequest2) {
    WillSaveTextDocumentWaitUntilRequest2.method = "textDocument/willSaveWaitUntil";
    WillSaveTextDocumentWaitUntilRequest2.type = new messages_1.ProtocolRequestType(WillSaveTextDocumentWaitUntilRequest2.method);
  })(WillSaveTextDocumentWaitUntilRequest = exports2.WillSaveTextDocumentWaitUntilRequest || (exports2.WillSaveTextDocumentWaitUntilRequest = {}));
  var DidChangeWatchedFilesNotification;
  (function(DidChangeWatchedFilesNotification2) {
    DidChangeWatchedFilesNotification2.type = new messages_1.ProtocolNotificationType("workspace/didChangeWatchedFiles");
  })(DidChangeWatchedFilesNotification = exports2.DidChangeWatchedFilesNotification || (exports2.DidChangeWatchedFilesNotification = {}));
  var FileChangeType;
  (function(FileChangeType2) {
    FileChangeType2.Created = 1;
    FileChangeType2.Changed = 2;
    FileChangeType2.Deleted = 3;
  })(FileChangeType = exports2.FileChangeType || (exports2.FileChangeType = {}));
  var WatchKind;
  (function(WatchKind2) {
    WatchKind2.Create = 1;
    WatchKind2.Change = 2;
    WatchKind2.Delete = 4;
  })(WatchKind = exports2.WatchKind || (exports2.WatchKind = {}));
  var PublishDiagnosticsNotification;
  (function(PublishDiagnosticsNotification2) {
    PublishDiagnosticsNotification2.type = new messages_1.ProtocolNotificationType("textDocument/publishDiagnostics");
  })(PublishDiagnosticsNotification = exports2.PublishDiagnosticsNotification || (exports2.PublishDiagnosticsNotification = {}));
  var CompletionTriggerKind;
  (function(CompletionTriggerKind2) {
    CompletionTriggerKind2.Invoked = 1;
    CompletionTriggerKind2.TriggerCharacter = 2;
    CompletionTriggerKind2.TriggerForIncompleteCompletions = 3;
  })(CompletionTriggerKind = exports2.CompletionTriggerKind || (exports2.CompletionTriggerKind = {}));
  var CompletionRequest;
  (function(CompletionRequest2) {
    CompletionRequest2.method = "textDocument/completion";
    CompletionRequest2.type = new messages_1.ProtocolRequestType(CompletionRequest2.method);
    CompletionRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(CompletionRequest = exports2.CompletionRequest || (exports2.CompletionRequest = {}));
  var CompletionResolveRequest;
  (function(CompletionResolveRequest2) {
    CompletionResolveRequest2.method = "completionItem/resolve";
    CompletionResolveRequest2.type = new messages_1.ProtocolRequestType(CompletionResolveRequest2.method);
  })(CompletionResolveRequest = exports2.CompletionResolveRequest || (exports2.CompletionResolveRequest = {}));
  var HoverRequest;
  (function(HoverRequest2) {
    HoverRequest2.method = "textDocument/hover";
    HoverRequest2.type = new messages_1.ProtocolRequestType(HoverRequest2.method);
  })(HoverRequest = exports2.HoverRequest || (exports2.HoverRequest = {}));
  var SignatureHelpTriggerKind;
  (function(SignatureHelpTriggerKind2) {
    SignatureHelpTriggerKind2.Invoked = 1;
    SignatureHelpTriggerKind2.TriggerCharacter = 2;
    SignatureHelpTriggerKind2.ContentChange = 3;
  })(SignatureHelpTriggerKind = exports2.SignatureHelpTriggerKind || (exports2.SignatureHelpTriggerKind = {}));
  var SignatureHelpRequest;
  (function(SignatureHelpRequest2) {
    SignatureHelpRequest2.method = "textDocument/signatureHelp";
    SignatureHelpRequest2.type = new messages_1.ProtocolRequestType(SignatureHelpRequest2.method);
  })(SignatureHelpRequest = exports2.SignatureHelpRequest || (exports2.SignatureHelpRequest = {}));
  var DefinitionRequest;
  (function(DefinitionRequest2) {
    DefinitionRequest2.method = "textDocument/definition";
    DefinitionRequest2.type = new messages_1.ProtocolRequestType(DefinitionRequest2.method);
    DefinitionRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(DefinitionRequest = exports2.DefinitionRequest || (exports2.DefinitionRequest = {}));
  var ReferencesRequest;
  (function(ReferencesRequest2) {
    ReferencesRequest2.method = "textDocument/references";
    ReferencesRequest2.type = new messages_1.ProtocolRequestType(ReferencesRequest2.method);
    ReferencesRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(ReferencesRequest = exports2.ReferencesRequest || (exports2.ReferencesRequest = {}));
  var DocumentHighlightRequest;
  (function(DocumentHighlightRequest2) {
    DocumentHighlightRequest2.method = "textDocument/documentHighlight";
    DocumentHighlightRequest2.type = new messages_1.ProtocolRequestType(DocumentHighlightRequest2.method);
    DocumentHighlightRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(DocumentHighlightRequest = exports2.DocumentHighlightRequest || (exports2.DocumentHighlightRequest = {}));
  var DocumentSymbolRequest;
  (function(DocumentSymbolRequest2) {
    DocumentSymbolRequest2.method = "textDocument/documentSymbol";
    DocumentSymbolRequest2.type = new messages_1.ProtocolRequestType(DocumentSymbolRequest2.method);
    DocumentSymbolRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(DocumentSymbolRequest = exports2.DocumentSymbolRequest || (exports2.DocumentSymbolRequest = {}));
  var CodeActionRequest;
  (function(CodeActionRequest2) {
    CodeActionRequest2.method = "textDocument/codeAction";
    CodeActionRequest2.type = new messages_1.ProtocolRequestType(CodeActionRequest2.method);
    CodeActionRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(CodeActionRequest = exports2.CodeActionRequest || (exports2.CodeActionRequest = {}));
  var WorkspaceSymbolRequest;
  (function(WorkspaceSymbolRequest2) {
    WorkspaceSymbolRequest2.method = "workspace/symbol";
    WorkspaceSymbolRequest2.type = new messages_1.ProtocolRequestType(WorkspaceSymbolRequest2.method);
    WorkspaceSymbolRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(WorkspaceSymbolRequest = exports2.WorkspaceSymbolRequest || (exports2.WorkspaceSymbolRequest = {}));
  var CodeLensRequest;
  (function(CodeLensRequest2) {
    CodeLensRequest2.type = new messages_1.ProtocolRequestType("textDocument/codeLens");
    CodeLensRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(CodeLensRequest = exports2.CodeLensRequest || (exports2.CodeLensRequest = {}));
  var CodeLensResolveRequest;
  (function(CodeLensResolveRequest2) {
    CodeLensResolveRequest2.type = new messages_1.ProtocolRequestType("codeLens/resolve");
  })(CodeLensResolveRequest = exports2.CodeLensResolveRequest || (exports2.CodeLensResolveRequest = {}));
  var DocumentLinkRequest;
  (function(DocumentLinkRequest2) {
    DocumentLinkRequest2.method = "textDocument/documentLink";
    DocumentLinkRequest2.type = new messages_1.ProtocolRequestType(DocumentLinkRequest2.method);
    DocumentLinkRequest2.resultType = new vscode_jsonrpc_1.ProgressType();
  })(DocumentLinkRequest = exports2.DocumentLinkRequest || (exports2.DocumentLinkRequest = {}));
  var DocumentLinkResolveRequest;
  (function(DocumentLinkResolveRequest2) {
    DocumentLinkResolveRequest2.type = new messages_1.ProtocolRequestType("documentLink/resolve");
  })(DocumentLinkResolveRequest = exports2.DocumentLinkResolveRequest || (exports2.DocumentLinkResolveRequest = {}));
  var DocumentFormattingRequest;
  (function(DocumentFormattingRequest2) {
    DocumentFormattingRequest2.method = "textDocument/formatting";
    DocumentFormattingRequest2.type = new messages_1.ProtocolRequestType(DocumentFormattingRequest2.method);
  })(DocumentFormattingRequest = exports2.DocumentFormattingRequest || (exports2.DocumentFormattingRequest = {}));
  var DocumentRangeFormattingRequest;
  (function(DocumentRangeFormattingRequest2) {
    DocumentRangeFormattingRequest2.method = "textDocument/rangeFormatting";
    DocumentRangeFormattingRequest2.type = new messages_1.ProtocolRequestType(DocumentRangeFormattingRequest2.method);
  })(DocumentRangeFormattingRequest = exports2.DocumentRangeFormattingRequest || (exports2.DocumentRangeFormattingRequest = {}));
  var DocumentOnTypeFormattingRequest;
  (function(DocumentOnTypeFormattingRequest2) {
    DocumentOnTypeFormattingRequest2.method = "textDocument/onTypeFormatting";
    DocumentOnTypeFormattingRequest2.type = new messages_1.ProtocolRequestType(DocumentOnTypeFormattingRequest2.method);
  })(DocumentOnTypeFormattingRequest = exports2.DocumentOnTypeFormattingRequest || (exports2.DocumentOnTypeFormattingRequest = {}));
  var RenameRequest;
  (function(RenameRequest2) {
    RenameRequest2.method = "textDocument/rename";
    RenameRequest2.type = new messages_1.ProtocolRequestType(RenameRequest2.method);
  })(RenameRequest = exports2.RenameRequest || (exports2.RenameRequest = {}));
  var PrepareRenameRequest;
  (function(PrepareRenameRequest2) {
    PrepareRenameRequest2.method = "textDocument/prepareRename";
    PrepareRenameRequest2.type = new messages_1.ProtocolRequestType(PrepareRenameRequest2.method);
  })(PrepareRenameRequest = exports2.PrepareRenameRequest || (exports2.PrepareRenameRequest = {}));
  var ExecuteCommandRequest;
  (function(ExecuteCommandRequest2) {
    ExecuteCommandRequest2.type = new messages_1.ProtocolRequestType("workspace/executeCommand");
  })(ExecuteCommandRequest = exports2.ExecuteCommandRequest || (exports2.ExecuteCommandRequest = {}));
  var ApplyWorkspaceEditRequest;
  (function(ApplyWorkspaceEditRequest2) {
    ApplyWorkspaceEditRequest2.type = new messages_1.ProtocolRequestType("workspace/applyEdit");
  })(ApplyWorkspaceEditRequest = exports2.ApplyWorkspaceEditRequest || (exports2.ApplyWorkspaceEditRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.callHierarchy.proposed.js
var require_protocol_callHierarchy_proposed = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var messages_1 = require_messages2();
  var CallHierarchyPrepareRequest;
  (function(CallHierarchyPrepareRequest2) {
    CallHierarchyPrepareRequest2.method = "textDocument/prepareCallHierarchy";
    CallHierarchyPrepareRequest2.type = new messages_1.ProtocolRequestType(CallHierarchyPrepareRequest2.method);
  })(CallHierarchyPrepareRequest = exports2.CallHierarchyPrepareRequest || (exports2.CallHierarchyPrepareRequest = {}));
  var CallHierarchyIncomingCallsRequest;
  (function(CallHierarchyIncomingCallsRequest2) {
    CallHierarchyIncomingCallsRequest2.method = "callHierarchy/incomingCalls";
    CallHierarchyIncomingCallsRequest2.type = new messages_1.ProtocolRequestType(CallHierarchyIncomingCallsRequest2.method);
  })(CallHierarchyIncomingCallsRequest = exports2.CallHierarchyIncomingCallsRequest || (exports2.CallHierarchyIncomingCallsRequest = {}));
  var CallHierarchyOutgoingCallsRequest;
  (function(CallHierarchyOutgoingCallsRequest2) {
    CallHierarchyOutgoingCallsRequest2.method = "callHierarchy/outgoingCalls";
    CallHierarchyOutgoingCallsRequest2.type = new messages_1.ProtocolRequestType(CallHierarchyOutgoingCallsRequest2.method);
  })(CallHierarchyOutgoingCallsRequest = exports2.CallHierarchyOutgoingCallsRequest || (exports2.CallHierarchyOutgoingCallsRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/protocol.sematicTokens.proposed.js
var require_protocol_sematicTokens_proposed = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var messages_1 = require_messages2();
  var SemanticTokenTypes;
  (function(SemanticTokenTypes2) {
    SemanticTokenTypes2["comment"] = "comment";
    SemanticTokenTypes2["keyword"] = "keyword";
    SemanticTokenTypes2["string"] = "string";
    SemanticTokenTypes2["number"] = "number";
    SemanticTokenTypes2["regexp"] = "regexp";
    SemanticTokenTypes2["operator"] = "operator";
    SemanticTokenTypes2["namespace"] = "namespace";
    SemanticTokenTypes2["type"] = "type";
    SemanticTokenTypes2["struct"] = "struct";
    SemanticTokenTypes2["class"] = "class";
    SemanticTokenTypes2["interface"] = "interface";
    SemanticTokenTypes2["enum"] = "enum";
    SemanticTokenTypes2["typeParameter"] = "typeParameter";
    SemanticTokenTypes2["function"] = "function";
    SemanticTokenTypes2["member"] = "member";
    SemanticTokenTypes2["property"] = "property";
    SemanticTokenTypes2["macro"] = "macro";
    SemanticTokenTypes2["variable"] = "variable";
    SemanticTokenTypes2["parameter"] = "parameter";
    SemanticTokenTypes2["label"] = "label";
  })(SemanticTokenTypes = exports2.SemanticTokenTypes || (exports2.SemanticTokenTypes = {}));
  var SemanticTokenModifiers;
  (function(SemanticTokenModifiers2) {
    SemanticTokenModifiers2["documentation"] = "documentation";
    SemanticTokenModifiers2["declaration"] = "declaration";
    SemanticTokenModifiers2["definition"] = "definition";
    SemanticTokenModifiers2["reference"] = "reference";
    SemanticTokenModifiers2["static"] = "static";
    SemanticTokenModifiers2["abstract"] = "abstract";
    SemanticTokenModifiers2["deprecated"] = "deprecated";
    SemanticTokenModifiers2["async"] = "async";
    SemanticTokenModifiers2["volatile"] = "volatile";
    SemanticTokenModifiers2["readonly"] = "readonly";
  })(SemanticTokenModifiers = exports2.SemanticTokenModifiers || (exports2.SemanticTokenModifiers = {}));
  var SemanticTokens;
  (function(SemanticTokens2) {
    function is(value) {
      const candidate = value;
      return candidate !== void 0 && (candidate.resultId === void 0 || typeof candidate.resultId === "string") && Array.isArray(candidate.data) && (candidate.data.length === 0 || typeof candidate.data[0] === "number");
    }
    SemanticTokens2.is = is;
  })(SemanticTokens = exports2.SemanticTokens || (exports2.SemanticTokens = {}));
  var SemanticTokensRequest;
  (function(SemanticTokensRequest2) {
    SemanticTokensRequest2.method = "textDocument/semanticTokens";
    SemanticTokensRequest2.type = new messages_1.ProtocolRequestType(SemanticTokensRequest2.method);
  })(SemanticTokensRequest = exports2.SemanticTokensRequest || (exports2.SemanticTokensRequest = {}));
  var SemanticTokensEditsRequest;
  (function(SemanticTokensEditsRequest2) {
    SemanticTokensEditsRequest2.method = "textDocument/semanticTokens/edits";
    SemanticTokensEditsRequest2.type = new messages_1.ProtocolRequestType(SemanticTokensEditsRequest2.method);
  })(SemanticTokensEditsRequest = exports2.SemanticTokensEditsRequest || (exports2.SemanticTokensEditsRequest = {}));
  var SemanticTokensRangeRequest;
  (function(SemanticTokensRangeRequest2) {
    SemanticTokensRangeRequest2.method = "textDocument/semanticTokens/range";
    SemanticTokensRangeRequest2.type = new messages_1.ProtocolRequestType(SemanticTokensRangeRequest2.method);
  })(SemanticTokensRangeRequest = exports2.SemanticTokensRangeRequest || (exports2.SemanticTokensRangeRequest = {}));
});

// node_modules/vscode-languageserver-protocol/lib/main.js
var require_main3 = __commonJS((exports2) => {
  "use strict";
  function __export2(m) {
    for (var p in m)
      if (!exports2.hasOwnProperty(p))
        exports2[p] = m[p];
  }
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_jsonrpc_1 = require_main();
  exports2.ErrorCodes = vscode_jsonrpc_1.ErrorCodes;
  exports2.ResponseError = vscode_jsonrpc_1.ResponseError;
  exports2.CancellationToken = vscode_jsonrpc_1.CancellationToken;
  exports2.CancellationTokenSource = vscode_jsonrpc_1.CancellationTokenSource;
  exports2.Disposable = vscode_jsonrpc_1.Disposable;
  exports2.Event = vscode_jsonrpc_1.Event;
  exports2.Emitter = vscode_jsonrpc_1.Emitter;
  exports2.Trace = vscode_jsonrpc_1.Trace;
  exports2.TraceFormat = vscode_jsonrpc_1.TraceFormat;
  exports2.SetTraceNotification = vscode_jsonrpc_1.SetTraceNotification;
  exports2.LogTraceNotification = vscode_jsonrpc_1.LogTraceNotification;
  exports2.RequestType = vscode_jsonrpc_1.RequestType;
  exports2.RequestType0 = vscode_jsonrpc_1.RequestType0;
  exports2.NotificationType = vscode_jsonrpc_1.NotificationType;
  exports2.NotificationType0 = vscode_jsonrpc_1.NotificationType0;
  exports2.MessageReader = vscode_jsonrpc_1.MessageReader;
  exports2.MessageWriter = vscode_jsonrpc_1.MessageWriter;
  exports2.ConnectionStrategy = vscode_jsonrpc_1.ConnectionStrategy;
  exports2.StreamMessageReader = vscode_jsonrpc_1.StreamMessageReader;
  exports2.StreamMessageWriter = vscode_jsonrpc_1.StreamMessageWriter;
  exports2.IPCMessageReader = vscode_jsonrpc_1.IPCMessageReader;
  exports2.IPCMessageWriter = vscode_jsonrpc_1.IPCMessageWriter;
  exports2.createClientPipeTransport = vscode_jsonrpc_1.createClientPipeTransport;
  exports2.createServerPipeTransport = vscode_jsonrpc_1.createServerPipeTransport;
  exports2.generateRandomPipeName = vscode_jsonrpc_1.generateRandomPipeName;
  exports2.createClientSocketTransport = vscode_jsonrpc_1.createClientSocketTransport;
  exports2.createServerSocketTransport = vscode_jsonrpc_1.createServerSocketTransport;
  exports2.ProgressType = vscode_jsonrpc_1.ProgressType;
  __export2(require_main2());
  __export2(require_protocol());
  var callHierarchy = require_protocol_callHierarchy_proposed();
  var st = require_protocol_sematicTokens_proposed();
  var Proposed;
  (function(Proposed2) {
    let CallHierarchyPrepareRequest;
    (function(CallHierarchyPrepareRequest2) {
      CallHierarchyPrepareRequest2.method = callHierarchy.CallHierarchyPrepareRequest.method;
      CallHierarchyPrepareRequest2.type = callHierarchy.CallHierarchyPrepareRequest.type;
    })(CallHierarchyPrepareRequest = Proposed2.CallHierarchyPrepareRequest || (Proposed2.CallHierarchyPrepareRequest = {}));
    let CallHierarchyIncomingCallsRequest;
    (function(CallHierarchyIncomingCallsRequest2) {
      CallHierarchyIncomingCallsRequest2.method = callHierarchy.CallHierarchyIncomingCallsRequest.method;
      CallHierarchyIncomingCallsRequest2.type = callHierarchy.CallHierarchyIncomingCallsRequest.type;
    })(CallHierarchyIncomingCallsRequest = Proposed2.CallHierarchyIncomingCallsRequest || (Proposed2.CallHierarchyIncomingCallsRequest = {}));
    let CallHierarchyOutgoingCallsRequest;
    (function(CallHierarchyOutgoingCallsRequest2) {
      CallHierarchyOutgoingCallsRequest2.method = callHierarchy.CallHierarchyOutgoingCallsRequest.method;
      CallHierarchyOutgoingCallsRequest2.type = callHierarchy.CallHierarchyOutgoingCallsRequest.type;
    })(CallHierarchyOutgoingCallsRequest = Proposed2.CallHierarchyOutgoingCallsRequest || (Proposed2.CallHierarchyOutgoingCallsRequest = {}));
    Proposed2.SemanticTokenTypes = st.SemanticTokenTypes;
    Proposed2.SemanticTokenModifiers = st.SemanticTokenModifiers;
    Proposed2.SemanticTokens = st.SemanticTokens;
    let SemanticTokensRequest;
    (function(SemanticTokensRequest2) {
      SemanticTokensRequest2.method = st.SemanticTokensRequest.method;
      SemanticTokensRequest2.type = st.SemanticTokensRequest.type;
    })(SemanticTokensRequest = Proposed2.SemanticTokensRequest || (Proposed2.SemanticTokensRequest = {}));
    let SemanticTokensEditsRequest;
    (function(SemanticTokensEditsRequest2) {
      SemanticTokensEditsRequest2.method = st.SemanticTokensEditsRequest.method;
      SemanticTokensEditsRequest2.type = st.SemanticTokensEditsRequest.type;
    })(SemanticTokensEditsRequest = Proposed2.SemanticTokensEditsRequest || (Proposed2.SemanticTokensEditsRequest = {}));
    let SemanticTokensRangeRequest;
    (function(SemanticTokensRangeRequest2) {
      SemanticTokensRangeRequest2.method = st.SemanticTokensRangeRequest.method;
      SemanticTokensRangeRequest2.type = st.SemanticTokensRangeRequest.type;
    })(SemanticTokensRangeRequest = Proposed2.SemanticTokensRangeRequest || (Proposed2.SemanticTokensRangeRequest = {}));
  })(Proposed = exports2.Proposed || (exports2.Proposed = {}));
  function createProtocolConnection(reader, writer, logger, strategy) {
    return vscode_jsonrpc_1.createMessageConnection(reader, writer, logger, strategy);
  }
  exports2.createProtocolConnection = createProtocolConnection;
});

// node_modules/vscode-languageclient/lib/utils/is.js
var require_is3 = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  function boolean(value) {
    return value === true || value === false;
  }
  exports2.boolean = boolean;
  function string(value) {
    return typeof value === "string" || value instanceof String;
  }
  exports2.string = string;
  function number(value) {
    return typeof value === "number" || value instanceof Number;
  }
  exports2.number = number;
  function error(value) {
    return value instanceof Error;
  }
  exports2.error = error;
  function func(value) {
    return typeof value === "function";
  }
  exports2.func = func;
  function array(value) {
    return Array.isArray(value);
  }
  exports2.array = array;
  function stringArray(value) {
    return array(value) && value.every((elem) => string(elem));
  }
  exports2.stringArray = stringArray;
  function typedArray(value, check) {
    return Array.isArray(value) && value.every(check);
  }
  exports2.typedArray = typedArray;
  function thenable(value) {
    return value && func(value.then);
  }
  exports2.thenable = thenable;
  function asPromise(value) {
    if (value instanceof Promise) {
      return value;
    } else if (thenable(value)) {
      return new Promise((resolve, reject) => {
        value.then((resolved) => resolve(resolved), (error2) => reject(error2));
      });
    } else {
      return Promise.resolve(value);
    }
  }
  exports2.asPromise = asPromise;
});

// node_modules/vscode-languageclient/lib/protocolCompletionItem.js
var require_protocolCompletionItem = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var code = require("vscode");
  var ProtocolCompletionItem = class extends code.CompletionItem {
    constructor(label) {
      super(label);
    }
  };
  exports2.default = ProtocolCompletionItem;
});

// node_modules/vscode-languageclient/lib/protocolCodeLens.js
var require_protocolCodeLens = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var code = require("vscode");
  var ProtocolCodeLens = class extends code.CodeLens {
    constructor(range) {
      super(range);
    }
  };
  exports2.default = ProtocolCodeLens;
});

// node_modules/vscode-languageclient/lib/protocolDocumentLink.js
var require_protocolDocumentLink = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var code = require("vscode");
  var ProtocolDocumentLink = class extends code.DocumentLink {
    constructor(range, target) {
      super(range, target);
    }
  };
  exports2.default = ProtocolDocumentLink;
});

// node_modules/vscode-languageclient/lib/codeConverter.js
var require_codeConverter = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var code = require("vscode");
  var proto = require_main3();
  var Is = require_is3();
  var protocolCompletionItem_1 = require_protocolCompletionItem();
  var protocolCodeLens_1 = require_protocolCodeLens();
  var protocolDocumentLink_1 = require_protocolDocumentLink();
  function createConverter(uriConverter) {
    const nullConverter = (value) => value.toString();
    const _uriConverter = uriConverter || nullConverter;
    function asUri(value) {
      return _uriConverter(value);
    }
    function asTextDocumentIdentifier(textDocument) {
      return {
        uri: _uriConverter(textDocument.uri)
      };
    }
    function asVersionedTextDocumentIdentifier(textDocument) {
      return {
        uri: _uriConverter(textDocument.uri),
        version: textDocument.version
      };
    }
    function asOpenTextDocumentParams(textDocument) {
      return {
        textDocument: {
          uri: _uriConverter(textDocument.uri),
          languageId: textDocument.languageId,
          version: textDocument.version,
          text: textDocument.getText()
        }
      };
    }
    function isTextDocumentChangeEvent(value) {
      let candidate = value;
      return !!candidate.document && !!candidate.contentChanges;
    }
    function isTextDocument(value) {
      let candidate = value;
      return !!candidate.uri && !!candidate.version;
    }
    function asChangeTextDocumentParams(arg) {
      if (isTextDocument(arg)) {
        let result = {
          textDocument: {
            uri: _uriConverter(arg.uri),
            version: arg.version
          },
          contentChanges: [{text: arg.getText()}]
        };
        return result;
      } else if (isTextDocumentChangeEvent(arg)) {
        let document = arg.document;
        let result = {
          textDocument: {
            uri: _uriConverter(document.uri),
            version: document.version
          },
          contentChanges: arg.contentChanges.map((change) => {
            let range = change.range;
            return {
              range: {
                start: {line: range.start.line, character: range.start.character},
                end: {line: range.end.line, character: range.end.character}
              },
              rangeLength: change.rangeLength,
              text: change.text
            };
          })
        };
        return result;
      } else {
        throw Error("Unsupported text document change parameter");
      }
    }
    function asCloseTextDocumentParams(textDocument) {
      return {
        textDocument: asTextDocumentIdentifier(textDocument)
      };
    }
    function asSaveTextDocumentParams(textDocument, includeContent = false) {
      let result = {
        textDocument: asVersionedTextDocumentIdentifier(textDocument)
      };
      if (includeContent) {
        result.text = textDocument.getText();
      }
      return result;
    }
    function asTextDocumentSaveReason(reason) {
      switch (reason) {
        case code.TextDocumentSaveReason.Manual:
          return proto.TextDocumentSaveReason.Manual;
        case code.TextDocumentSaveReason.AfterDelay:
          return proto.TextDocumentSaveReason.AfterDelay;
        case code.TextDocumentSaveReason.FocusOut:
          return proto.TextDocumentSaveReason.FocusOut;
      }
      return proto.TextDocumentSaveReason.Manual;
    }
    function asWillSaveTextDocumentParams(event) {
      return {
        textDocument: asTextDocumentIdentifier(event.document),
        reason: asTextDocumentSaveReason(event.reason)
      };
    }
    function asTextDocumentPositionParams(textDocument, position) {
      return {
        textDocument: asTextDocumentIdentifier(textDocument),
        position: asWorkerPosition(position)
      };
    }
    function asCompletionTriggerKind(triggerKind) {
      switch (triggerKind) {
        case code.CompletionTriggerKind.TriggerCharacter:
          return proto.CompletionTriggerKind.TriggerCharacter;
        case code.CompletionTriggerKind.TriggerForIncompleteCompletions:
          return proto.CompletionTriggerKind.TriggerForIncompleteCompletions;
        default:
          return proto.CompletionTriggerKind.Invoked;
      }
    }
    function asCompletionParams(textDocument, position, context) {
      return {
        textDocument: asTextDocumentIdentifier(textDocument),
        position: asWorkerPosition(position),
        context: {
          triggerKind: asCompletionTriggerKind(context.triggerKind),
          triggerCharacter: context.triggerCharacter
        }
      };
    }
    function asSignatureHelpTriggerKind(triggerKind) {
      switch (triggerKind) {
        case code.SignatureHelpTriggerKind.Invoke:
          return proto.SignatureHelpTriggerKind.Invoked;
        case code.SignatureHelpTriggerKind.TriggerCharacter:
          return proto.SignatureHelpTriggerKind.TriggerCharacter;
        case code.SignatureHelpTriggerKind.ContentChange:
          return proto.SignatureHelpTriggerKind.ContentChange;
      }
    }
    function asParameterInformation(value) {
      return {
        label: value.label
      };
    }
    function asParameterInformations(values) {
      return values.map(asParameterInformation);
    }
    function asSignatureInformation(value) {
      return {
        label: value.label,
        parameters: asParameterInformations(value.parameters)
      };
    }
    function asSignatureInformations(values) {
      return values.map(asSignatureInformation);
    }
    function asSignatureHelp(value) {
      if (value === void 0) {
        return value;
      }
      return {
        signatures: asSignatureInformations(value.signatures),
        activeSignature: value.activeSignature,
        activeParameter: value.activeParameter
      };
    }
    function asSignatureHelpParams(textDocument, position, context) {
      return {
        textDocument: asTextDocumentIdentifier(textDocument),
        position: asWorkerPosition(position),
        context: {
          isRetrigger: context.isRetrigger,
          triggerCharacter: context.triggerCharacter,
          triggerKind: asSignatureHelpTriggerKind(context.triggerKind),
          activeSignatureHelp: asSignatureHelp(context.activeSignatureHelp)
        }
      };
    }
    function asWorkerPosition(position) {
      return {line: position.line, character: position.character};
    }
    function asPosition(value) {
      if (value === void 0 || value === null) {
        return value;
      }
      return {line: value.line, character: value.character};
    }
    function asPositions(value) {
      let result = [];
      for (let elem of value) {
        result.push(asPosition(elem));
      }
      return result;
    }
    function isInsertReplace(value) {
      const candidate = value;
      return candidate && !!candidate.inserting && !!candidate.replacing;
    }
    function asRange(value) {
      if (value === void 0 || value === null) {
        return value;
      }
      if (isInsertReplace(value)) {
        throw new Error(`Receving unknown insert replace range.`);
      }
      return {start: asPosition(value.start), end: asPosition(value.end)};
    }
    function asLocation(value) {
      if (value === void 0 || value === null) {
        return value;
      }
      return proto.Location.create(asUri(value.uri), asRange(value.range));
    }
    function asDiagnosticSeverity(value) {
      switch (value) {
        case code.DiagnosticSeverity.Error:
          return proto.DiagnosticSeverity.Error;
        case code.DiagnosticSeverity.Warning:
          return proto.DiagnosticSeverity.Warning;
        case code.DiagnosticSeverity.Information:
          return proto.DiagnosticSeverity.Information;
        case code.DiagnosticSeverity.Hint:
          return proto.DiagnosticSeverity.Hint;
      }
    }
    function asDiagnosticTags(tags) {
      if (!tags) {
        return void 0;
      }
      let result = [];
      for (let tag of tags) {
        let converted = asDiagnosticTag(tag);
        if (converted !== void 0) {
          result.push(converted);
        }
      }
      return result.length > 0 ? result : void 0;
    }
    function asDiagnosticTag(tag) {
      switch (tag) {
        case code.DiagnosticTag.Unnecessary:
          return proto.DiagnosticTag.Unnecessary;
        case code.DiagnosticTag.Deprecated:
          return proto.DiagnosticTag.Deprecated;
        default:
          return void 0;
      }
    }
    function asRelatedInformation(item) {
      return {
        message: item.message,
        location: asLocation(item.location)
      };
    }
    function asRelatedInformations(items) {
      return items.map(asRelatedInformation);
    }
    function asDiagnostic(item) {
      let result = proto.Diagnostic.create(asRange(item.range), item.message);
      if (Is.number(item.severity)) {
        result.severity = asDiagnosticSeverity(item.severity);
      }
      if (Is.number(item.code) || Is.string(item.code)) {
        result.code = item.code;
      }
      if (Array.isArray(item.tags)) {
        result.tags = asDiagnosticTags(item.tags);
      }
      if (item.relatedInformation) {
        result.relatedInformation = asRelatedInformations(item.relatedInformation);
      }
      if (item.source) {
        result.source = item.source;
      }
      return result;
    }
    function asDiagnostics(items) {
      if (items === void 0 || items === null) {
        return items;
      }
      return items.map(asDiagnostic);
    }
    function asDocumentation(format, documentation) {
      switch (format) {
        case "$string":
          return documentation;
        case proto.MarkupKind.PlainText:
          return {kind: format, value: documentation};
        case proto.MarkupKind.Markdown:
          return {kind: format, value: documentation.value};
        default:
          return `Unsupported Markup content received. Kind is: ${format}`;
      }
    }
    function asCompletionItemTag(tag) {
      switch (tag) {
        case code.CompletionItemTag.Deprecated:
          return proto.CompletionItemTag.Deprecated;
      }
      return void 0;
    }
    function asCompletionItemTags(tags) {
      if (tags === void 0) {
        return tags;
      }
      const result = [];
      for (let tag of tags) {
        const converted = asCompletionItemTag(tag);
        if (converted !== void 0) {
          result.push(converted);
        }
      }
      return result;
    }
    function asCompletionItemKind(value, original) {
      if (original !== void 0) {
        return original;
      }
      return value + 1;
    }
    function asCompletionItem(item) {
      let result = {label: item.label};
      let protocolItem = item instanceof protocolCompletionItem_1.default ? item : void 0;
      if (item.detail) {
        result.detail = item.detail;
      }
      if (item.documentation) {
        if (!protocolItem || protocolItem.documentationFormat === "$string") {
          result.documentation = item.documentation;
        } else {
          result.documentation = asDocumentation(protocolItem.documentationFormat, item.documentation);
        }
      }
      if (item.filterText) {
        result.filterText = item.filterText;
      }
      fillPrimaryInsertText(result, item);
      if (Is.number(item.kind)) {
        result.kind = asCompletionItemKind(item.kind, protocolItem && protocolItem.originalItemKind);
      }
      if (item.sortText) {
        result.sortText = item.sortText;
      }
      if (item.additionalTextEdits) {
        result.additionalTextEdits = asTextEdits(item.additionalTextEdits);
      }
      if (item.commitCharacters) {
        result.commitCharacters = item.commitCharacters.slice();
      }
      if (item.command) {
        result.command = asCommand(item.command);
      }
      if (item.preselect === true || item.preselect === false) {
        result.preselect = item.preselect;
      }
      const tags = asCompletionItemTags(item.tags);
      if (protocolItem) {
        if (protocolItem.data !== void 0) {
          result.data = protocolItem.data;
        }
        if (protocolItem.deprecated === true || protocolItem.deprecated === false) {
          if (protocolItem.deprecated === true && tags !== void 0 && tags.length > 0) {
            const index = tags.indexOf(code.CompletionItemTag.Deprecated);
            if (index !== -1) {
              tags.splice(index, 1);
            }
          }
          result.deprecated = protocolItem.deprecated;
        }
      }
      if (tags !== void 0 && tags.length > 0) {
        result.tags = tags;
      }
      return result;
    }
    function fillPrimaryInsertText(target, source) {
      let format = proto.InsertTextFormat.PlainText;
      let text = void 0;
      let range = void 0;
      if (source.textEdit) {
        text = source.textEdit.newText;
        range = asRange(source.textEdit.range);
      } else if (source.insertText instanceof code.SnippetString) {
        format = proto.InsertTextFormat.Snippet;
        text = source.insertText.value;
      } else {
        text = source.insertText;
      }
      if (source.range) {
        range = asRange(source.range);
      }
      target.insertTextFormat = format;
      if (source.fromEdit && text !== void 0 && range !== void 0) {
        target.textEdit = {newText: text, range};
      } else {
        target.insertText = text;
      }
    }
    function asTextEdit(edit) {
      return {range: asRange(edit.range), newText: edit.newText};
    }
    function asTextEdits(edits) {
      if (edits === void 0 || edits === null) {
        return edits;
      }
      return edits.map(asTextEdit);
    }
    function asSymbolKind(item) {
      if (item <= code.SymbolKind.TypeParameter) {
        return item + 1;
      }
      return proto.SymbolKind.Property;
    }
    function asSymbolTag(item) {
      return item;
    }
    function asSymbolTags(items) {
      return items.map(asSymbolTag);
    }
    function asReferenceParams(textDocument, position, options) {
      return {
        textDocument: asTextDocumentIdentifier(textDocument),
        position: asWorkerPosition(position),
        context: {includeDeclaration: options.includeDeclaration}
      };
    }
    function asCodeActionContext(context) {
      if (context === void 0 || context === null) {
        return context;
      }
      let only;
      if (context.only && Is.string(context.only.value)) {
        only = [context.only.value];
      }
      return proto.CodeActionContext.create(asDiagnostics(context.diagnostics), only);
    }
    function asCommand(item) {
      let result = proto.Command.create(item.title, item.command);
      if (item.arguments) {
        result.arguments = item.arguments;
      }
      return result;
    }
    function asCodeLens(item) {
      let result = proto.CodeLens.create(asRange(item.range));
      if (item.command) {
        result.command = asCommand(item.command);
      }
      if (item instanceof protocolCodeLens_1.default) {
        if (item.data) {
          result.data = item.data;
        }
      }
      return result;
    }
    function asFormattingOptions(item) {
      return {tabSize: item.tabSize, insertSpaces: item.insertSpaces};
    }
    function asDocumentSymbolParams(textDocument) {
      return {
        textDocument: asTextDocumentIdentifier(textDocument)
      };
    }
    function asCodeLensParams(textDocument) {
      return {
        textDocument: asTextDocumentIdentifier(textDocument)
      };
    }
    function asDocumentLink(item) {
      let result = proto.DocumentLink.create(asRange(item.range));
      if (item.target) {
        result.target = asUri(item.target);
      }
      if (item.tooltip !== void 0) {
        result.tooltip = item.tooltip;
      }
      let protocolItem = item instanceof protocolDocumentLink_1.default ? item : void 0;
      if (protocolItem && protocolItem.data) {
        result.data = protocolItem.data;
      }
      return result;
    }
    function asDocumentLinkParams(textDocument) {
      return {
        textDocument: asTextDocumentIdentifier(textDocument)
      };
    }
    return {
      asUri,
      asTextDocumentIdentifier,
      asVersionedTextDocumentIdentifier,
      asOpenTextDocumentParams,
      asChangeTextDocumentParams,
      asCloseTextDocumentParams,
      asSaveTextDocumentParams,
      asWillSaveTextDocumentParams,
      asTextDocumentPositionParams,
      asCompletionParams,
      asSignatureHelpParams,
      asWorkerPosition,
      asRange,
      asPosition,
      asPositions,
      asLocation,
      asDiagnosticSeverity,
      asDiagnosticTag,
      asDiagnostic,
      asDiagnostics,
      asCompletionItem,
      asTextEdit,
      asSymbolKind,
      asSymbolTag,
      asSymbolTags,
      asReferenceParams,
      asCodeActionContext,
      asCommand,
      asCodeLens,
      asFormattingOptions,
      asDocumentSymbolParams,
      asCodeLensParams,
      asDocumentLink,
      asDocumentLinkParams
    };
  }
  exports2.createConverter = createConverter;
});

// node_modules/vscode-languageclient/lib/protocolConverter.js
var require_protocolConverter = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var code = require("vscode");
  var ls = require_main3();
  var Is = require_is3();
  var protocolCompletionItem_1 = require_protocolCompletionItem();
  var protocolCodeLens_1 = require_protocolCodeLens();
  var protocolDocumentLink_1 = require_protocolDocumentLink();
  var CodeBlock;
  (function(CodeBlock2) {
    function is(value) {
      let candidate = value;
      return candidate && Is.string(candidate.language) && Is.string(candidate.value);
    }
    CodeBlock2.is = is;
  })(CodeBlock || (CodeBlock = {}));
  function createConverter(uriConverter) {
    const nullConverter = (value) => code.Uri.parse(value);
    const _uriConverter = uriConverter || nullConverter;
    function asUri(value) {
      return _uriConverter(value);
    }
    function asDiagnostics(diagnostics) {
      return diagnostics.map(asDiagnostic);
    }
    function asDiagnostic(diagnostic) {
      let result = new code.Diagnostic(asRange(diagnostic.range), diagnostic.message, asDiagnosticSeverity(diagnostic.severity));
      if (Is.number(diagnostic.code) || Is.string(diagnostic.code)) {
        result.code = diagnostic.code;
      }
      if (diagnostic.source) {
        result.source = diagnostic.source;
      }
      if (diagnostic.relatedInformation) {
        result.relatedInformation = asRelatedInformation(diagnostic.relatedInformation);
      }
      if (Array.isArray(diagnostic.tags)) {
        result.tags = asDiagnosticTags(diagnostic.tags);
      }
      return result;
    }
    function asRelatedInformation(relatedInformation) {
      return relatedInformation.map(asDiagnosticRelatedInformation);
    }
    function asDiagnosticRelatedInformation(information) {
      return new code.DiagnosticRelatedInformation(asLocation(information.location), information.message);
    }
    function asDiagnosticTags(tags) {
      if (!tags) {
        return void 0;
      }
      let result = [];
      for (let tag of tags) {
        let converted = asDiagnosticTag(tag);
        if (converted !== void 0) {
          result.push(converted);
        }
      }
      return result.length > 0 ? result : void 0;
    }
    function asDiagnosticTag(tag) {
      switch (tag) {
        case ls.DiagnosticTag.Unnecessary:
          return code.DiagnosticTag.Unnecessary;
        case ls.DiagnosticTag.Deprecated:
          return code.DiagnosticTag.Deprecated;
        default:
          return void 0;
      }
    }
    function asPosition(value) {
      if (!value) {
        return void 0;
      }
      return new code.Position(value.line, value.character);
    }
    function asRange(value) {
      if (!value) {
        return void 0;
      }
      return new code.Range(asPosition(value.start), asPosition(value.end));
    }
    function asRanges(value) {
      return value.map((value2) => asRange(value2));
    }
    function asDiagnosticSeverity(value) {
      if (value === void 0 || value === null) {
        return code.DiagnosticSeverity.Error;
      }
      switch (value) {
        case ls.DiagnosticSeverity.Error:
          return code.DiagnosticSeverity.Error;
        case ls.DiagnosticSeverity.Warning:
          return code.DiagnosticSeverity.Warning;
        case ls.DiagnosticSeverity.Information:
          return code.DiagnosticSeverity.Information;
        case ls.DiagnosticSeverity.Hint:
          return code.DiagnosticSeverity.Hint;
      }
      return code.DiagnosticSeverity.Error;
    }
    function asHoverContent(value) {
      if (Is.string(value)) {
        return new code.MarkdownString(value);
      } else if (CodeBlock.is(value)) {
        let result = new code.MarkdownString();
        return result.appendCodeblock(value.value, value.language);
      } else if (Array.isArray(value)) {
        let result = [];
        for (let element of value) {
          let item = new code.MarkdownString();
          if (CodeBlock.is(element)) {
            item.appendCodeblock(element.value, element.language);
          } else {
            item.appendMarkdown(element);
          }
          result.push(item);
        }
        return result;
      } else {
        let result;
        switch (value.kind) {
          case ls.MarkupKind.Markdown:
            return new code.MarkdownString(value.value);
          case ls.MarkupKind.PlainText:
            result = new code.MarkdownString();
            result.appendText(value.value);
            return result;
          default:
            result = new code.MarkdownString();
            result.appendText(`Unsupported Markup content received. Kind is: ${value.kind}`);
            return result;
        }
      }
    }
    function asDocumentation(value) {
      if (Is.string(value)) {
        return value;
      } else {
        switch (value.kind) {
          case ls.MarkupKind.Markdown:
            return new code.MarkdownString(value.value);
          case ls.MarkupKind.PlainText:
            return value.value;
          default:
            return `Unsupported Markup content received. Kind is: ${value.kind}`;
        }
      }
    }
    function asHover(hover) {
      if (!hover) {
        return void 0;
      }
      return new code.Hover(asHoverContent(hover.contents), asRange(hover.range));
    }
    function asCompletionResult(result) {
      if (!result) {
        return void 0;
      }
      if (Array.isArray(result)) {
        let items = result;
        return items.map(asCompletionItem);
      }
      let list = result;
      return new code.CompletionList(list.items.map(asCompletionItem), list.isIncomplete);
    }
    function asCompletionItemKind(value) {
      if (ls.CompletionItemKind.Text <= value && value <= ls.CompletionItemKind.TypeParameter) {
        return [value - 1, void 0];
      }
      return [code.CompletionItemKind.Text, value];
    }
    function asCompletionItemTag(tag) {
      switch (tag) {
        case ls.CompletionItemTag.Deprecated:
          return code.CompletionItemTag.Deprecated;
      }
      return void 0;
    }
    function asCompletionItemTags(tags) {
      if (tags === void 0 || tags === null) {
        return [];
      }
      const result = [];
      for (let tag of tags) {
        const converted = asCompletionItemTag(tag);
        if (converted !== void 0) {
          result.push(converted);
        }
      }
      return result;
    }
    function asCompletionItem(item) {
      let tags = asCompletionItemTags(item.tags);
      let result = new protocolCompletionItem_1.default(item.label);
      if (item.detail) {
        result.detail = item.detail;
      }
      if (item.documentation) {
        result.documentation = asDocumentation(item.documentation);
        result.documentationFormat = Is.string(item.documentation) ? "$string" : item.documentation.kind;
      }
      if (item.filterText) {
        result.filterText = item.filterText;
      }
      let insertText = asCompletionInsertText(item);
      if (insertText) {
        result.insertText = insertText.text;
        result.range = insertText.range;
        result.fromEdit = insertText.fromEdit;
      }
      if (Is.number(item.kind)) {
        let [itemKind, original] = asCompletionItemKind(item.kind);
        result.kind = itemKind;
        if (original) {
          result.originalItemKind = original;
        }
      }
      if (item.sortText) {
        result.sortText = item.sortText;
      }
      if (item.additionalTextEdits) {
        result.additionalTextEdits = asTextEdits(item.additionalTextEdits);
      }
      if (Is.stringArray(item.commitCharacters)) {
        result.commitCharacters = item.commitCharacters.slice();
      }
      if (item.command) {
        result.command = asCommand(item.command);
      }
      if (item.deprecated === true || item.deprecated === false) {
        result.deprecated = item.deprecated;
        if (item.deprecated === true) {
          tags.push(code.CompletionItemTag.Deprecated);
        }
      }
      if (item.preselect === true || item.preselect === false) {
        result.preselect = item.preselect;
      }
      if (item.data !== void 0) {
        result.data = item.data;
      }
      if (tags.length > 0) {
        result.tags = tags;
      }
      return result;
    }
    function asCompletionInsertText(item) {
      if (item.textEdit) {
        if (item.insertTextFormat === ls.InsertTextFormat.Snippet) {
          return {text: new code.SnippetString(item.textEdit.newText), range: asRange(item.textEdit.range), fromEdit: true};
        } else {
          return {text: item.textEdit.newText, range: asRange(item.textEdit.range), fromEdit: true};
        }
      } else if (item.insertText) {
        if (item.insertTextFormat === ls.InsertTextFormat.Snippet) {
          return {text: new code.SnippetString(item.insertText), fromEdit: false};
        } else {
          return {text: item.insertText, fromEdit: false};
        }
      } else {
        return void 0;
      }
    }
    function asTextEdit(edit) {
      if (!edit) {
        return void 0;
      }
      return new code.TextEdit(asRange(edit.range), edit.newText);
    }
    function asTextEdits(items) {
      if (!items) {
        return void 0;
      }
      return items.map(asTextEdit);
    }
    function asSignatureHelp(item) {
      if (!item) {
        return void 0;
      }
      let result = new code.SignatureHelp();
      if (Is.number(item.activeSignature)) {
        result.activeSignature = item.activeSignature;
      } else {
        result.activeSignature = 0;
      }
      if (Is.number(item.activeParameter)) {
        result.activeParameter = item.activeParameter;
      } else {
        result.activeParameter = 0;
      }
      if (item.signatures) {
        result.signatures = asSignatureInformations(item.signatures);
      }
      return result;
    }
    function asSignatureInformations(items) {
      return items.map(asSignatureInformation);
    }
    function asSignatureInformation(item) {
      let result = new code.SignatureInformation(item.label);
      if (item.documentation) {
        result.documentation = asDocumentation(item.documentation);
      }
      if (item.parameters) {
        result.parameters = asParameterInformations(item.parameters);
      }
      return result;
    }
    function asParameterInformations(item) {
      return item.map(asParameterInformation);
    }
    function asParameterInformation(item) {
      let result = new code.ParameterInformation(item.label);
      if (item.documentation) {
        result.documentation = asDocumentation(item.documentation);
      }
      return result;
    }
    function asLocation(item) {
      if (!item) {
        return void 0;
      }
      return new code.Location(_uriConverter(item.uri), asRange(item.range));
    }
    function asDeclarationResult(item) {
      if (!item) {
        return void 0;
      }
      return asLocationResult(item);
    }
    function asDefinitionResult(item) {
      if (!item) {
        return void 0;
      }
      return asLocationResult(item);
    }
    function asLocationLink(item) {
      if (!item) {
        return void 0;
      }
      let result = {
        targetUri: _uriConverter(item.targetUri),
        targetRange: asRange(item.targetSelectionRange),
        originSelectionRange: asRange(item.originSelectionRange),
        targetSelectionRange: asRange(item.targetSelectionRange)
      };
      if (!result.targetSelectionRange) {
        throw new Error(`targetSelectionRange must not be undefined or null`);
      }
      return result;
    }
    function asLocationResult(item) {
      if (!item) {
        return void 0;
      }
      if (Is.array(item)) {
        if (item.length === 0) {
          return [];
        } else if (ls.LocationLink.is(item[0])) {
          let links = item;
          return links.map((link) => asLocationLink(link));
        } else {
          let locations = item;
          return locations.map((location) => asLocation(location));
        }
      } else if (ls.LocationLink.is(item)) {
        return [asLocationLink(item)];
      } else {
        return asLocation(item);
      }
    }
    function asReferences(values) {
      if (!values) {
        return void 0;
      }
      return values.map((location) => asLocation(location));
    }
    function asDocumentHighlights(values) {
      if (!values) {
        return void 0;
      }
      return values.map(asDocumentHighlight);
    }
    function asDocumentHighlight(item) {
      let result = new code.DocumentHighlight(asRange(item.range));
      if (Is.number(item.kind)) {
        result.kind = asDocumentHighlightKind(item.kind);
      }
      return result;
    }
    function asDocumentHighlightKind(item) {
      switch (item) {
        case ls.DocumentHighlightKind.Text:
          return code.DocumentHighlightKind.Text;
        case ls.DocumentHighlightKind.Read:
          return code.DocumentHighlightKind.Read;
        case ls.DocumentHighlightKind.Write:
          return code.DocumentHighlightKind.Write;
      }
      return code.DocumentHighlightKind.Text;
    }
    function asSymbolInformations(values, uri) {
      if (!values) {
        return void 0;
      }
      return values.map((information) => asSymbolInformation(information, uri));
    }
    function asSymbolKind(item) {
      if (item <= ls.SymbolKind.TypeParameter) {
        return item - 1;
      }
      return code.SymbolKind.Property;
    }
    function asSymbolTag(value) {
      return value;
    }
    function asSymbolTags(items) {
      if (items === void 0 || items === null) {
        return void 0;
      }
      return items.map(asSymbolTag);
    }
    function asSymbolInformation(item, uri) {
      let result = new code.SymbolInformation(item.name, asSymbolKind(item.kind), asRange(item.location.range), item.location.uri ? _uriConverter(item.location.uri) : uri);
      if (item.containerName) {
        result.containerName = item.containerName;
      }
      return result;
    }
    function asDocumentSymbols(values) {
      if (values === void 0 || values === null) {
        return void 0;
      }
      return values.map(asDocumentSymbol);
    }
    function asDocumentSymbol(value) {
      let result = new code.DocumentSymbol(value.name, value.detail || "", asSymbolKind(value.kind), asRange(value.range), asRange(value.selectionRange));
      if (value.children !== void 0 && value.children.length > 0) {
        let children = [];
        for (let child of value.children) {
          children.push(asDocumentSymbol(child));
        }
        result.children = children;
      }
      return result;
    }
    function asCommand(item) {
      let result = {title: item.title, command: item.command};
      if (item.arguments) {
        result.arguments = item.arguments;
      }
      return result;
    }
    function asCommands(items) {
      if (!items) {
        return void 0;
      }
      return items.map(asCommand);
    }
    const kindMapping = new Map();
    kindMapping.set(ls.CodeActionKind.Empty, code.CodeActionKind.Empty);
    kindMapping.set(ls.CodeActionKind.QuickFix, code.CodeActionKind.QuickFix);
    kindMapping.set(ls.CodeActionKind.Refactor, code.CodeActionKind.Refactor);
    kindMapping.set(ls.CodeActionKind.RefactorExtract, code.CodeActionKind.RefactorExtract);
    kindMapping.set(ls.CodeActionKind.RefactorInline, code.CodeActionKind.RefactorInline);
    kindMapping.set(ls.CodeActionKind.RefactorRewrite, code.CodeActionKind.RefactorRewrite);
    kindMapping.set(ls.CodeActionKind.Source, code.CodeActionKind.Source);
    kindMapping.set(ls.CodeActionKind.SourceOrganizeImports, code.CodeActionKind.SourceOrganizeImports);
    function asCodeActionKind(item) {
      if (item === void 0 || item === null) {
        return void 0;
      }
      let result = kindMapping.get(item);
      if (result) {
        return result;
      }
      let parts = item.split(".");
      result = code.CodeActionKind.Empty;
      for (let part of parts) {
        result = result.append(part);
      }
      return result;
    }
    function asCodeActionKinds(items) {
      if (items === void 0 || items === null) {
        return void 0;
      }
      return items.map((kind) => asCodeActionKind(kind));
    }
    function asCodeAction(item) {
      if (item === void 0 || item === null) {
        return void 0;
      }
      let result = new code.CodeAction(item.title);
      if (item.kind !== void 0) {
        result.kind = asCodeActionKind(item.kind);
      }
      if (item.diagnostics) {
        result.diagnostics = asDiagnostics(item.diagnostics);
      }
      if (item.edit) {
        result.edit = asWorkspaceEdit(item.edit);
      }
      if (item.command) {
        result.command = asCommand(item.command);
      }
      if (item.isPreferred !== void 0) {
        result.isPreferred = item.isPreferred;
      }
      return result;
    }
    function asCodeLens(item) {
      if (!item) {
        return void 0;
      }
      let result = new protocolCodeLens_1.default(asRange(item.range));
      if (item.command) {
        result.command = asCommand(item.command);
      }
      if (item.data !== void 0 && item.data !== null) {
        result.data = item.data;
      }
      return result;
    }
    function asCodeLenses(items) {
      if (!items) {
        return void 0;
      }
      return items.map((codeLens) => asCodeLens(codeLens));
    }
    function asWorkspaceEdit(item) {
      if (!item) {
        return void 0;
      }
      let result = new code.WorkspaceEdit();
      if (item.documentChanges) {
        item.documentChanges.forEach((change) => {
          if (ls.CreateFile.is(change)) {
            result.createFile(_uriConverter(change.uri), change.options);
          } else if (ls.RenameFile.is(change)) {
            result.renameFile(_uriConverter(change.oldUri), _uriConverter(change.newUri), change.options);
          } else if (ls.DeleteFile.is(change)) {
            result.deleteFile(_uriConverter(change.uri), change.options);
          } else if (ls.TextDocumentEdit.is(change)) {
            result.set(_uriConverter(change.textDocument.uri), asTextEdits(change.edits));
          } else {
            console.error(`Unknown workspace edit change received:
${JSON.stringify(change, void 0, 4)}`);
          }
        });
      } else if (item.changes) {
        Object.keys(item.changes).forEach((key) => {
          result.set(_uriConverter(key), asTextEdits(item.changes[key]));
        });
      }
      return result;
    }
    function asDocumentLink(item) {
      let range = asRange(item.range);
      let target = item.target ? asUri(item.target) : void 0;
      let link = new protocolDocumentLink_1.default(range, target);
      if (item.tooltip !== void 0) {
        link.tooltip = item.tooltip;
      }
      if (item.data !== void 0 && item.data !== null) {
        link.data = item.data;
      }
      return link;
    }
    function asDocumentLinks(items) {
      if (!items) {
        return void 0;
      }
      return items.map(asDocumentLink);
    }
    function asColor(color) {
      return new code.Color(color.red, color.green, color.blue, color.alpha);
    }
    function asColorInformation(ci) {
      return new code.ColorInformation(asRange(ci.range), asColor(ci.color));
    }
    function asColorInformations(colorInformation) {
      if (Array.isArray(colorInformation)) {
        return colorInformation.map(asColorInformation);
      }
      return void 0;
    }
    function asColorPresentation(cp) {
      let presentation = new code.ColorPresentation(cp.label);
      presentation.additionalTextEdits = asTextEdits(cp.additionalTextEdits);
      if (cp.textEdit) {
        presentation.textEdit = asTextEdit(cp.textEdit);
      }
      return presentation;
    }
    function asColorPresentations(colorPresentations) {
      if (Array.isArray(colorPresentations)) {
        return colorPresentations.map(asColorPresentation);
      }
      return void 0;
    }
    function asFoldingRangeKind(kind) {
      if (kind) {
        switch (kind) {
          case ls.FoldingRangeKind.Comment:
            return code.FoldingRangeKind.Comment;
          case ls.FoldingRangeKind.Imports:
            return code.FoldingRangeKind.Imports;
          case ls.FoldingRangeKind.Region:
            return code.FoldingRangeKind.Region;
        }
      }
      return void 0;
    }
    function asFoldingRange(r) {
      return new code.FoldingRange(r.startLine, r.endLine, asFoldingRangeKind(r.kind));
    }
    function asFoldingRanges(foldingRanges) {
      if (Array.isArray(foldingRanges)) {
        return foldingRanges.map(asFoldingRange);
      }
      return void 0;
    }
    function asSelectionRange(selectionRange) {
      return new code.SelectionRange(asRange(selectionRange.range), selectionRange.parent ? asSelectionRange(selectionRange.parent) : void 0);
    }
    function asSelectionRanges(selectionRanges) {
      if (!Array.isArray(selectionRanges)) {
        return [];
      }
      let result = [];
      for (let range of selectionRanges) {
        result.push(asSelectionRange(range));
      }
      return result;
    }
    return {
      asUri,
      asDiagnostics,
      asDiagnostic,
      asRange,
      asRanges,
      asPosition,
      asDiagnosticSeverity,
      asDiagnosticTag,
      asHover,
      asCompletionResult,
      asCompletionItem,
      asTextEdit,
      asTextEdits,
      asSignatureHelp,
      asSignatureInformations,
      asSignatureInformation,
      asParameterInformations,
      asParameterInformation,
      asDeclarationResult,
      asDefinitionResult,
      asLocation,
      asReferences,
      asDocumentHighlights,
      asDocumentHighlight,
      asDocumentHighlightKind,
      asSymbolKind,
      asSymbolTag,
      asSymbolTags,
      asSymbolInformations,
      asSymbolInformation,
      asDocumentSymbols,
      asDocumentSymbol,
      asCommand,
      asCommands,
      asCodeAction,
      asCodeActionKind,
      asCodeActionKinds,
      asCodeLens,
      asCodeLenses,
      asWorkspaceEdit,
      asDocumentLink,
      asDocumentLinks,
      asFoldingRangeKind,
      asFoldingRange,
      asFoldingRanges,
      asColor,
      asColorInformation,
      asColorInformations,
      asColorPresentation,
      asColorPresentations,
      asSelectionRange,
      asSelectionRanges
    };
  }
  exports2.createConverter = createConverter;
});

// node_modules/vscode-languageclient/lib/utils/async.js
var require_async = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var Delayer = class {
    constructor(defaultDelay) {
      this.defaultDelay = defaultDelay;
      this.timeout = void 0;
      this.completionPromise = void 0;
      this.onSuccess = void 0;
      this.task = void 0;
    }
    trigger(task, delay = this.defaultDelay) {
      this.task = task;
      if (delay >= 0) {
        this.cancelTimeout();
      }
      if (!this.completionPromise) {
        this.completionPromise = new Promise((resolve) => {
          this.onSuccess = resolve;
        }).then(() => {
          this.completionPromise = void 0;
          this.onSuccess = void 0;
          var result = this.task();
          this.task = void 0;
          return result;
        });
      }
      if (delay >= 0 || this.timeout === void 0) {
        this.timeout = setTimeout(() => {
          this.timeout = void 0;
          this.onSuccess(void 0);
        }, delay >= 0 ? delay : this.defaultDelay);
      }
      return this.completionPromise;
    }
    forceDelivery() {
      if (!this.completionPromise) {
        return void 0;
      }
      this.cancelTimeout();
      let result = this.task();
      this.completionPromise = void 0;
      this.onSuccess = void 0;
      this.task = void 0;
      return result;
    }
    isTriggered() {
      return this.timeout !== void 0;
    }
    cancel() {
      this.cancelTimeout();
      this.completionPromise = void 0;
    }
    cancelTimeout() {
      if (this.timeout !== void 0) {
        clearTimeout(this.timeout);
        this.timeout = void 0;
      }
    }
  };
  exports2.Delayer = Delayer;
});

// node_modules/vscode-languageclient/lib/utils/uuid.js
var require_uuid = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var ValueUUID = class {
    constructor(_value) {
      this._value = _value;
    }
    asHex() {
      return this._value;
    }
    equals(other) {
      return this.asHex() === other.asHex();
    }
  };
  var V4UUID = class extends ValueUUID {
    constructor() {
      super([
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        "-",
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        "-",
        "4",
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        "-",
        V4UUID._oneOf(V4UUID._timeHighBits),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        "-",
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex(),
        V4UUID._randomHex()
      ].join(""));
    }
    static _oneOf(array) {
      return array[Math.floor(array.length * Math.random())];
    }
    static _randomHex() {
      return V4UUID._oneOf(V4UUID._chars);
    }
  };
  V4UUID._chars = ["0", "1", "2", "3", "4", "5", "6", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
  V4UUID._timeHighBits = ["8", "9", "a", "b"];
  exports2.empty = new ValueUUID("00000000-0000-0000-0000-000000000000");
  function v4() {
    return new V4UUID();
  }
  exports2.v4 = v4;
  var _UUIDPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function isUUID(value) {
    return _UUIDPattern.test(value);
  }
  exports2.isUUID = isUUID;
  function parse(value) {
    if (!isUUID(value)) {
      throw new Error("invalid uuid");
    }
    return new ValueUUID(value);
  }
  exports2.parse = parse;
  function generateUuid() {
    return v4().asHex();
  }
  exports2.generateUuid = generateUuid;
});

// node_modules/vscode-languageclient/lib/progressPart.js
var require_progressPart = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var Is = require_is3();
  var ProgressPart = class {
    constructor(_client, _token) {
      this._client = _client;
      this._token = _token;
      this._reported = 0;
      this._disposable = this._client.onProgress(vscode_languageserver_protocol_1.WorkDoneProgress.type, this._token, (value) => {
        switch (value.kind) {
          case "begin":
            this.begin(value);
            break;
          case "report":
            this.report(value);
            break;
          case "end":
            this.done();
            break;
        }
      });
    }
    begin(params) {
      let location = params.cancellable ? vscode_1.ProgressLocation.Notification : vscode_1.ProgressLocation.Window;
      vscode_1.window.withProgress({location, cancellable: params.cancellable, title: params.title}, async (progress, cancellationToken) => {
        this._progress = progress;
        this._infinite = params.percentage === void 0;
        this._cancellationToken = cancellationToken;
        this._cancellationToken.onCancellationRequested(() => {
          this._client.sendNotification(vscode_languageserver_protocol_1.WorkDoneProgressCancelNotification.type, {token: this._token});
        });
        this.report(params);
        return new Promise((resolve, reject) => {
          this._resolve = resolve;
          this._reject = reject;
        });
      });
    }
    report(params) {
      if (this._infinite && Is.string(params.message)) {
        this._progress.report({message: params.message});
      } else if (Is.number(params.percentage)) {
        let percentage = Math.max(0, Math.min(params.percentage, 100));
        let delta = Math.max(0, percentage - this._reported);
        this._progress.report({message: params.message, increment: delta});
        this._reported += delta;
      }
    }
    cancel() {
      if (this._disposable) {
        this._disposable.dispose();
        this._disposable = void 0;
      }
      if (this._reject) {
        this._reject();
        this._resolve = void 0;
        this._reject = void 0;
      }
    }
    done() {
      if (this._disposable) {
        this._disposable.dispose();
        this._disposable = void 0;
      }
      if (this._resolve) {
        this._resolve();
        this._resolve = void 0;
        this._reject = void 0;
      }
    }
  };
  exports2.ProgressPart = ProgressPart;
});

// node_modules/vscode-languageclient/lib/client.js
var require_client = __commonJS((exports2) => {
  "use strict";
  function __export2(m) {
    for (var p in m)
      if (!exports2.hasOwnProperty(p))
        exports2[p] = m[p];
  }
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var c2p = require_codeConverter();
  var p2c = require_protocolConverter();
  var Is = require_is3();
  var async_1 = require_async();
  var UUID = require_uuid();
  var progressPart_1 = require_progressPart();
  __export2(require_main3());
  var ConsoleLogger = class {
    error(message) {
      console.error(message);
    }
    warn(message) {
      console.warn(message);
    }
    info(message) {
      console.info(message);
    }
    log(message) {
      console.log(message);
    }
  };
  function createConnection(input, output, errorHandler, closeHandler) {
    let logger = new ConsoleLogger();
    let connection = vscode_languageserver_protocol_1.createProtocolConnection(input, output, logger);
    connection.onError((data) => {
      errorHandler(data[0], data[1], data[2]);
    });
    connection.onClose(closeHandler);
    let result = {
      listen: () => connection.listen(),
      sendRequest: (type, ...params) => connection.sendRequest(Is.string(type) ? type : type.method, ...params),
      onRequest: (type, handler) => connection.onRequest(Is.string(type) ? type : type.method, handler),
      sendNotification: (type, params) => connection.sendNotification(Is.string(type) ? type : type.method, params),
      onNotification: (type, handler) => connection.onNotification(Is.string(type) ? type : type.method, handler),
      onProgress: connection.onProgress,
      sendProgress: connection.sendProgress,
      trace: (value, tracer, sendNotificationOrTraceOptions) => {
        const defaultTraceOptions = {
          sendNotification: false,
          traceFormat: vscode_languageserver_protocol_1.TraceFormat.Text
        };
        if (sendNotificationOrTraceOptions === void 0) {
          connection.trace(value, tracer, defaultTraceOptions);
        } else if (Is.boolean(sendNotificationOrTraceOptions)) {
          connection.trace(value, tracer, sendNotificationOrTraceOptions);
        } else {
          connection.trace(value, tracer, sendNotificationOrTraceOptions);
        }
      },
      initialize: (params) => connection.sendRequest(vscode_languageserver_protocol_1.InitializeRequest.type, params),
      shutdown: () => connection.sendRequest(vscode_languageserver_protocol_1.ShutdownRequest.type, void 0),
      exit: () => connection.sendNotification(vscode_languageserver_protocol_1.ExitNotification.type),
      onLogMessage: (handler) => connection.onNotification(vscode_languageserver_protocol_1.LogMessageNotification.type, handler),
      onShowMessage: (handler) => connection.onNotification(vscode_languageserver_protocol_1.ShowMessageNotification.type, handler),
      onTelemetry: (handler) => connection.onNotification(vscode_languageserver_protocol_1.TelemetryEventNotification.type, handler),
      didChangeConfiguration: (params) => connection.sendNotification(vscode_languageserver_protocol_1.DidChangeConfigurationNotification.type, params),
      didChangeWatchedFiles: (params) => connection.sendNotification(vscode_languageserver_protocol_1.DidChangeWatchedFilesNotification.type, params),
      didOpenTextDocument: (params) => connection.sendNotification(vscode_languageserver_protocol_1.DidOpenTextDocumentNotification.type, params),
      didChangeTextDocument: (params) => connection.sendNotification(vscode_languageserver_protocol_1.DidChangeTextDocumentNotification.type, params),
      didCloseTextDocument: (params) => connection.sendNotification(vscode_languageserver_protocol_1.DidCloseTextDocumentNotification.type, params),
      didSaveTextDocument: (params) => connection.sendNotification(vscode_languageserver_protocol_1.DidSaveTextDocumentNotification.type, params),
      onDiagnostics: (handler) => connection.onNotification(vscode_languageserver_protocol_1.PublishDiagnosticsNotification.type, handler),
      dispose: () => connection.dispose()
    };
    return result;
  }
  var ErrorAction;
  (function(ErrorAction2) {
    ErrorAction2[ErrorAction2["Continue"] = 1] = "Continue";
    ErrorAction2[ErrorAction2["Shutdown"] = 2] = "Shutdown";
  })(ErrorAction = exports2.ErrorAction || (exports2.ErrorAction = {}));
  var CloseAction;
  (function(CloseAction2) {
    CloseAction2[CloseAction2["DoNotRestart"] = 1] = "DoNotRestart";
    CloseAction2[CloseAction2["Restart"] = 2] = "Restart";
  })(CloseAction = exports2.CloseAction || (exports2.CloseAction = {}));
  var DefaultErrorHandler = class {
    constructor(name) {
      this.name = name;
      this.restarts = [];
    }
    error(_error, _message, count) {
      if (count && count <= 3) {
        return ErrorAction.Continue;
      }
      return ErrorAction.Shutdown;
    }
    closed() {
      this.restarts.push(Date.now());
      if (this.restarts.length < 5) {
        return CloseAction.Restart;
      } else {
        let diff = this.restarts[this.restarts.length - 1] - this.restarts[0];
        if (diff <= 3 * 60 * 1e3) {
          vscode_1.window.showErrorMessage(`The ${this.name} server crashed 5 times in the last 3 minutes. The server will not be restarted.`);
          return CloseAction.DoNotRestart;
        } else {
          this.restarts.shift();
          return CloseAction.Restart;
        }
      }
    }
  };
  var RevealOutputChannelOn;
  (function(RevealOutputChannelOn2) {
    RevealOutputChannelOn2[RevealOutputChannelOn2["Info"] = 1] = "Info";
    RevealOutputChannelOn2[RevealOutputChannelOn2["Warn"] = 2] = "Warn";
    RevealOutputChannelOn2[RevealOutputChannelOn2["Error"] = 3] = "Error";
    RevealOutputChannelOn2[RevealOutputChannelOn2["Never"] = 4] = "Never";
  })(RevealOutputChannelOn = exports2.RevealOutputChannelOn || (exports2.RevealOutputChannelOn = {}));
  var State;
  (function(State2) {
    State2[State2["Stopped"] = 1] = "Stopped";
    State2[State2["Starting"] = 3] = "Starting";
    State2[State2["Running"] = 2] = "Running";
  })(State = exports2.State || (exports2.State = {}));
  var ClientState;
  (function(ClientState2) {
    ClientState2[ClientState2["Initial"] = 0] = "Initial";
    ClientState2[ClientState2["Starting"] = 1] = "Starting";
    ClientState2[ClientState2["StartFailed"] = 2] = "StartFailed";
    ClientState2[ClientState2["Running"] = 3] = "Running";
    ClientState2[ClientState2["Stopping"] = 4] = "Stopping";
    ClientState2[ClientState2["Stopped"] = 5] = "Stopped";
  })(ClientState || (ClientState = {}));
  var SupportedSymbolKinds = [
    vscode_languageserver_protocol_1.SymbolKind.File,
    vscode_languageserver_protocol_1.SymbolKind.Module,
    vscode_languageserver_protocol_1.SymbolKind.Namespace,
    vscode_languageserver_protocol_1.SymbolKind.Package,
    vscode_languageserver_protocol_1.SymbolKind.Class,
    vscode_languageserver_protocol_1.SymbolKind.Method,
    vscode_languageserver_protocol_1.SymbolKind.Property,
    vscode_languageserver_protocol_1.SymbolKind.Field,
    vscode_languageserver_protocol_1.SymbolKind.Constructor,
    vscode_languageserver_protocol_1.SymbolKind.Enum,
    vscode_languageserver_protocol_1.SymbolKind.Interface,
    vscode_languageserver_protocol_1.SymbolKind.Function,
    vscode_languageserver_protocol_1.SymbolKind.Variable,
    vscode_languageserver_protocol_1.SymbolKind.Constant,
    vscode_languageserver_protocol_1.SymbolKind.String,
    vscode_languageserver_protocol_1.SymbolKind.Number,
    vscode_languageserver_protocol_1.SymbolKind.Boolean,
    vscode_languageserver_protocol_1.SymbolKind.Array,
    vscode_languageserver_protocol_1.SymbolKind.Object,
    vscode_languageserver_protocol_1.SymbolKind.Key,
    vscode_languageserver_protocol_1.SymbolKind.Null,
    vscode_languageserver_protocol_1.SymbolKind.EnumMember,
    vscode_languageserver_protocol_1.SymbolKind.Struct,
    vscode_languageserver_protocol_1.SymbolKind.Event,
    vscode_languageserver_protocol_1.SymbolKind.Operator,
    vscode_languageserver_protocol_1.SymbolKind.TypeParameter
  ];
  var SupportedCompletionItemKinds = [
    vscode_languageserver_protocol_1.CompletionItemKind.Text,
    vscode_languageserver_protocol_1.CompletionItemKind.Method,
    vscode_languageserver_protocol_1.CompletionItemKind.Function,
    vscode_languageserver_protocol_1.CompletionItemKind.Constructor,
    vscode_languageserver_protocol_1.CompletionItemKind.Field,
    vscode_languageserver_protocol_1.CompletionItemKind.Variable,
    vscode_languageserver_protocol_1.CompletionItemKind.Class,
    vscode_languageserver_protocol_1.CompletionItemKind.Interface,
    vscode_languageserver_protocol_1.CompletionItemKind.Module,
    vscode_languageserver_protocol_1.CompletionItemKind.Property,
    vscode_languageserver_protocol_1.CompletionItemKind.Unit,
    vscode_languageserver_protocol_1.CompletionItemKind.Value,
    vscode_languageserver_protocol_1.CompletionItemKind.Enum,
    vscode_languageserver_protocol_1.CompletionItemKind.Keyword,
    vscode_languageserver_protocol_1.CompletionItemKind.Snippet,
    vscode_languageserver_protocol_1.CompletionItemKind.Color,
    vscode_languageserver_protocol_1.CompletionItemKind.File,
    vscode_languageserver_protocol_1.CompletionItemKind.Reference,
    vscode_languageserver_protocol_1.CompletionItemKind.Folder,
    vscode_languageserver_protocol_1.CompletionItemKind.EnumMember,
    vscode_languageserver_protocol_1.CompletionItemKind.Constant,
    vscode_languageserver_protocol_1.CompletionItemKind.Struct,
    vscode_languageserver_protocol_1.CompletionItemKind.Event,
    vscode_languageserver_protocol_1.CompletionItemKind.Operator,
    vscode_languageserver_protocol_1.CompletionItemKind.TypeParameter
  ];
  function ensure(target, key) {
    if (target[key] === void 0) {
      target[key] = {};
    }
    return target[key];
  }
  var DynamicFeature;
  (function(DynamicFeature2) {
    function is(value) {
      let candidate = value;
      return candidate && Is.func(candidate.register) && Is.func(candidate.unregister) && Is.func(candidate.dispose) && candidate.messages !== void 0;
    }
    DynamicFeature2.is = is;
  })(DynamicFeature || (DynamicFeature = {}));
  var DocumentNotifiactions = class {
    constructor(_client, _event, _type, _middleware, _createParams, _selectorFilter) {
      this._client = _client;
      this._event = _event;
      this._type = _type;
      this._middleware = _middleware;
      this._createParams = _createParams;
      this._selectorFilter = _selectorFilter;
      this._selectors = new Map();
    }
    static textDocumentFilter(selectors, textDocument) {
      for (const selector of selectors) {
        if (vscode_1.languages.match(selector, textDocument)) {
          return true;
        }
      }
      return false;
    }
    register(_message, data) {
      if (!data.registerOptions.documentSelector) {
        return;
      }
      if (!this._listener) {
        this._listener = this._event(this.callback, this);
      }
      this._selectors.set(data.id, data.registerOptions.documentSelector);
    }
    callback(data) {
      if (!this._selectorFilter || this._selectorFilter(this._selectors.values(), data)) {
        if (this._middleware) {
          this._middleware(data, (data2) => this._client.sendNotification(this._type, this._createParams(data2)));
        } else {
          this._client.sendNotification(this._type, this._createParams(data));
        }
        this.notificationSent(data);
      }
    }
    notificationSent(_data) {
    }
    unregister(id) {
      this._selectors.delete(id);
      if (this._selectors.size === 0 && this._listener) {
        this._listener.dispose();
        this._listener = void 0;
      }
    }
    dispose() {
      this._selectors.clear();
      if (this._listener) {
        this._listener.dispose();
        this._listener = void 0;
      }
    }
    getProvider(document) {
      for (const selector of this._selectors.values()) {
        if (vscode_1.languages.match(selector, document)) {
          return {
            send: (data) => {
              this.callback(data);
            }
          };
        }
      }
      throw new Error(`No provider available for the given text document`);
    }
  };
  var DidOpenTextDocumentFeature = class extends DocumentNotifiactions {
    constructor(client2, _syncedDocuments) {
      super(client2, vscode_1.workspace.onDidOpenTextDocument, vscode_languageserver_protocol_1.DidOpenTextDocumentNotification.type, client2.clientOptions.middleware.didOpen, (textDocument) => client2.code2ProtocolConverter.asOpenTextDocumentParams(textDocument), DocumentNotifiactions.textDocumentFilter);
      this._syncedDocuments = _syncedDocuments;
    }
    get messages() {
      return vscode_languageserver_protocol_1.DidOpenTextDocumentNotification.type;
    }
    fillClientCapabilities(capabilities) {
      ensure(ensure(capabilities, "textDocument"), "synchronization").dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      let textDocumentSyncOptions = capabilities.resolvedTextDocumentSync;
      if (documentSelector && textDocumentSyncOptions && textDocumentSyncOptions.openClose) {
        this.register(this.messages, {id: UUID.generateUuid(), registerOptions: {documentSelector}});
      }
    }
    register(message, data) {
      super.register(message, data);
      if (!data.registerOptions.documentSelector) {
        return;
      }
      let documentSelector = data.registerOptions.documentSelector;
      vscode_1.workspace.textDocuments.forEach((textDocument) => {
        let uri = textDocument.uri.toString();
        if (this._syncedDocuments.has(uri)) {
          return;
        }
        if (vscode_1.languages.match(documentSelector, textDocument)) {
          let middleware = this._client.clientOptions.middleware;
          let didOpen = (textDocument2) => {
            this._client.sendNotification(this._type, this._createParams(textDocument2));
          };
          if (middleware.didOpen) {
            middleware.didOpen(textDocument, didOpen);
          } else {
            didOpen(textDocument);
          }
          this._syncedDocuments.set(uri, textDocument);
        }
      });
    }
    notificationSent(textDocument) {
      super.notificationSent(textDocument);
      this._syncedDocuments.set(textDocument.uri.toString(), textDocument);
    }
  };
  var DidCloseTextDocumentFeature = class extends DocumentNotifiactions {
    constructor(client2, _syncedDocuments) {
      super(client2, vscode_1.workspace.onDidCloseTextDocument, vscode_languageserver_protocol_1.DidCloseTextDocumentNotification.type, client2.clientOptions.middleware.didClose, (textDocument) => client2.code2ProtocolConverter.asCloseTextDocumentParams(textDocument), DocumentNotifiactions.textDocumentFilter);
      this._syncedDocuments = _syncedDocuments;
    }
    get messages() {
      return vscode_languageserver_protocol_1.DidCloseTextDocumentNotification.type;
    }
    fillClientCapabilities(capabilities) {
      ensure(ensure(capabilities, "textDocument"), "synchronization").dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      let textDocumentSyncOptions = capabilities.resolvedTextDocumentSync;
      if (documentSelector && textDocumentSyncOptions && textDocumentSyncOptions.openClose) {
        this.register(this.messages, {id: UUID.generateUuid(), registerOptions: {documentSelector}});
      }
    }
    notificationSent(textDocument) {
      super.notificationSent(textDocument);
      this._syncedDocuments.delete(textDocument.uri.toString());
    }
    unregister(id) {
      let selector = this._selectors.get(id);
      super.unregister(id);
      let selectors = this._selectors.values();
      this._syncedDocuments.forEach((textDocument) => {
        if (vscode_1.languages.match(selector, textDocument) && !this._selectorFilter(selectors, textDocument)) {
          let middleware = this._client.clientOptions.middleware;
          let didClose = (textDocument2) => {
            this._client.sendNotification(this._type, this._createParams(textDocument2));
          };
          this._syncedDocuments.delete(textDocument.uri.toString());
          if (middleware.didClose) {
            middleware.didClose(textDocument, didClose);
          } else {
            didClose(textDocument);
          }
        }
      });
    }
  };
  var DidChangeTextDocumentFeature = class {
    constructor(_client) {
      this._client = _client;
      this._changeData = new Map();
      this._forcingDelivery = false;
    }
    get messages() {
      return vscode_languageserver_protocol_1.DidChangeTextDocumentNotification.type;
    }
    fillClientCapabilities(capabilities) {
      ensure(ensure(capabilities, "textDocument"), "synchronization").dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      let textDocumentSyncOptions = capabilities.resolvedTextDocumentSync;
      if (documentSelector && textDocumentSyncOptions && textDocumentSyncOptions.change !== void 0 && textDocumentSyncOptions.change !== vscode_languageserver_protocol_1.TextDocumentSyncKind.None) {
        this.register(this.messages, {
          id: UUID.generateUuid(),
          registerOptions: Object.assign({}, {documentSelector}, {syncKind: textDocumentSyncOptions.change})
        });
      }
    }
    register(_message, data) {
      if (!data.registerOptions.documentSelector) {
        return;
      }
      if (!this._listener) {
        this._listener = vscode_1.workspace.onDidChangeTextDocument(this.callback, this);
      }
      this._changeData.set(data.id, {
        documentSelector: data.registerOptions.documentSelector,
        syncKind: data.registerOptions.syncKind
      });
    }
    callback(event) {
      if (event.contentChanges.length === 0) {
        return;
      }
      for (const changeData of this._changeData.values()) {
        if (vscode_1.languages.match(changeData.documentSelector, event.document)) {
          let middleware = this._client.clientOptions.middleware;
          if (changeData.syncKind === vscode_languageserver_protocol_1.TextDocumentSyncKind.Incremental) {
            let params = this._client.code2ProtocolConverter.asChangeTextDocumentParams(event);
            if (middleware.didChange) {
              middleware.didChange(event, () => this._client.sendNotification(vscode_languageserver_protocol_1.DidChangeTextDocumentNotification.type, params));
            } else {
              this._client.sendNotification(vscode_languageserver_protocol_1.DidChangeTextDocumentNotification.type, params);
            }
          } else if (changeData.syncKind === vscode_languageserver_protocol_1.TextDocumentSyncKind.Full) {
            let didChange = (event2) => {
              if (this._changeDelayer) {
                if (this._changeDelayer.uri !== event2.document.uri.toString()) {
                  this.forceDelivery();
                  this._changeDelayer.uri = event2.document.uri.toString();
                }
                this._changeDelayer.delayer.trigger(() => {
                  this._client.sendNotification(vscode_languageserver_protocol_1.DidChangeTextDocumentNotification.type, this._client.code2ProtocolConverter.asChangeTextDocumentParams(event2.document));
                });
              } else {
                this._changeDelayer = {
                  uri: event2.document.uri.toString(),
                  delayer: new async_1.Delayer(200)
                };
                this._changeDelayer.delayer.trigger(() => {
                  this._client.sendNotification(vscode_languageserver_protocol_1.DidChangeTextDocumentNotification.type, this._client.code2ProtocolConverter.asChangeTextDocumentParams(event2.document));
                }, -1);
              }
            };
            if (middleware.didChange) {
              middleware.didChange(event, didChange);
            } else {
              didChange(event);
            }
          }
        }
      }
    }
    unregister(id) {
      this._changeData.delete(id);
      if (this._changeData.size === 0 && this._listener) {
        this._listener.dispose();
        this._listener = void 0;
      }
    }
    dispose() {
      this._changeDelayer = void 0;
      this._forcingDelivery = false;
      this._changeData.clear();
      if (this._listener) {
        this._listener.dispose();
        this._listener = void 0;
      }
    }
    forceDelivery() {
      if (this._forcingDelivery || !this._changeDelayer) {
        return;
      }
      try {
        this._forcingDelivery = true;
        this._changeDelayer.delayer.forceDelivery();
      } finally {
        this._forcingDelivery = false;
      }
    }
    getProvider(document) {
      for (const changeData of this._changeData.values()) {
        if (vscode_1.languages.match(changeData.documentSelector, document)) {
          return {
            send: (event) => {
              this.callback(event);
            }
          };
        }
      }
      throw new Error(`No provider available for the given text document`);
    }
  };
  var WillSaveFeature = class extends DocumentNotifiactions {
    constructor(client2) {
      super(client2, vscode_1.workspace.onWillSaveTextDocument, vscode_languageserver_protocol_1.WillSaveTextDocumentNotification.type, client2.clientOptions.middleware.willSave, (willSaveEvent) => client2.code2ProtocolConverter.asWillSaveTextDocumentParams(willSaveEvent), (selectors, willSaveEvent) => DocumentNotifiactions.textDocumentFilter(selectors, willSaveEvent.document));
    }
    get messages() {
      return vscode_languageserver_protocol_1.WillSaveTextDocumentNotification.type;
    }
    fillClientCapabilities(capabilities) {
      let value = ensure(ensure(capabilities, "textDocument"), "synchronization");
      value.willSave = true;
    }
    initialize(capabilities, documentSelector) {
      let textDocumentSyncOptions = capabilities.resolvedTextDocumentSync;
      if (documentSelector && textDocumentSyncOptions && textDocumentSyncOptions.willSave) {
        this.register(this.messages, {
          id: UUID.generateUuid(),
          registerOptions: {documentSelector}
        });
      }
    }
  };
  var WillSaveWaitUntilFeature = class {
    constructor(_client) {
      this._client = _client;
      this._selectors = new Map();
    }
    get messages() {
      return vscode_languageserver_protocol_1.WillSaveTextDocumentWaitUntilRequest.type;
    }
    fillClientCapabilities(capabilities) {
      let value = ensure(ensure(capabilities, "textDocument"), "synchronization");
      value.willSaveWaitUntil = true;
    }
    initialize(capabilities, documentSelector) {
      let textDocumentSyncOptions = capabilities.resolvedTextDocumentSync;
      if (documentSelector && textDocumentSyncOptions && textDocumentSyncOptions.willSaveWaitUntil) {
        this.register(this.messages, {
          id: UUID.generateUuid(),
          registerOptions: {documentSelector}
        });
      }
    }
    register(_message, data) {
      if (!data.registerOptions.documentSelector) {
        return;
      }
      if (!this._listener) {
        this._listener = vscode_1.workspace.onWillSaveTextDocument(this.callback, this);
      }
      this._selectors.set(data.id, data.registerOptions.documentSelector);
    }
    callback(event) {
      if (DocumentNotifiactions.textDocumentFilter(this._selectors.values(), event.document)) {
        let middleware = this._client.clientOptions.middleware;
        let willSaveWaitUntil = (event2) => {
          return this._client.sendRequest(vscode_languageserver_protocol_1.WillSaveTextDocumentWaitUntilRequest.type, this._client.code2ProtocolConverter.asWillSaveTextDocumentParams(event2)).then((edits) => {
            let vEdits = this._client.protocol2CodeConverter.asTextEdits(edits);
            return vEdits === void 0 ? [] : vEdits;
          });
        };
        event.waitUntil(middleware.willSaveWaitUntil ? middleware.willSaveWaitUntil(event, willSaveWaitUntil) : willSaveWaitUntil(event));
      }
    }
    unregister(id) {
      this._selectors.delete(id);
      if (this._selectors.size === 0 && this._listener) {
        this._listener.dispose();
        this._listener = void 0;
      }
    }
    dispose() {
      this._selectors.clear();
      if (this._listener) {
        this._listener.dispose();
        this._listener = void 0;
      }
    }
  };
  var DidSaveTextDocumentFeature = class extends DocumentNotifiactions {
    constructor(client2) {
      super(client2, vscode_1.workspace.onDidSaveTextDocument, vscode_languageserver_protocol_1.DidSaveTextDocumentNotification.type, client2.clientOptions.middleware.didSave, (textDocument) => client2.code2ProtocolConverter.asSaveTextDocumentParams(textDocument, this._includeText), DocumentNotifiactions.textDocumentFilter);
    }
    get messages() {
      return vscode_languageserver_protocol_1.DidSaveTextDocumentNotification.type;
    }
    fillClientCapabilities(capabilities) {
      ensure(ensure(capabilities, "textDocument"), "synchronization").didSave = true;
    }
    initialize(capabilities, documentSelector) {
      let textDocumentSyncOptions = capabilities.resolvedTextDocumentSync;
      if (documentSelector && textDocumentSyncOptions && textDocumentSyncOptions.save) {
        this.register(this.messages, {
          id: UUID.generateUuid(),
          registerOptions: Object.assign({}, {documentSelector}, {includeText: !!textDocumentSyncOptions.save.includeText})
        });
      }
    }
    register(method, data) {
      this._includeText = !!data.registerOptions.includeText;
      super.register(method, data);
    }
  };
  var FileSystemWatcherFeature = class {
    constructor(_client, _notifyFileEvent) {
      this._client = _client;
      this._notifyFileEvent = _notifyFileEvent;
      this._watchers = new Map();
    }
    get messages() {
      return vscode_languageserver_protocol_1.DidChangeWatchedFilesNotification.type;
    }
    fillClientCapabilities(capabilities) {
      ensure(ensure(capabilities, "workspace"), "didChangeWatchedFiles").dynamicRegistration = true;
    }
    initialize(_capabilities, _documentSelector) {
    }
    register(_method, data) {
      if (!Array.isArray(data.registerOptions.watchers)) {
        return;
      }
      let disposeables = [];
      for (let watcher of data.registerOptions.watchers) {
        if (!Is.string(watcher.globPattern)) {
          continue;
        }
        let watchCreate = true, watchChange = true, watchDelete = true;
        if (watcher.kind !== void 0 && watcher.kind !== null) {
          watchCreate = (watcher.kind & vscode_languageserver_protocol_1.WatchKind.Create) !== 0;
          watchChange = (watcher.kind & vscode_languageserver_protocol_1.WatchKind.Change) !== 0;
          watchDelete = (watcher.kind & vscode_languageserver_protocol_1.WatchKind.Delete) !== 0;
        }
        let fileSystemWatcher = vscode_1.workspace.createFileSystemWatcher(watcher.globPattern, !watchCreate, !watchChange, !watchDelete);
        this.hookListeners(fileSystemWatcher, watchCreate, watchChange, watchDelete);
        disposeables.push(fileSystemWatcher);
      }
      this._watchers.set(data.id, disposeables);
    }
    registerRaw(id, fileSystemWatchers) {
      let disposeables = [];
      for (let fileSystemWatcher of fileSystemWatchers) {
        this.hookListeners(fileSystemWatcher, true, true, true, disposeables);
      }
      this._watchers.set(id, disposeables);
    }
    hookListeners(fileSystemWatcher, watchCreate, watchChange, watchDelete, listeners) {
      if (watchCreate) {
        fileSystemWatcher.onDidCreate((resource) => this._notifyFileEvent({
          uri: this._client.code2ProtocolConverter.asUri(resource),
          type: vscode_languageserver_protocol_1.FileChangeType.Created
        }), null, listeners);
      }
      if (watchChange) {
        fileSystemWatcher.onDidChange((resource) => this._notifyFileEvent({
          uri: this._client.code2ProtocolConverter.asUri(resource),
          type: vscode_languageserver_protocol_1.FileChangeType.Changed
        }), null, listeners);
      }
      if (watchDelete) {
        fileSystemWatcher.onDidDelete((resource) => this._notifyFileEvent({
          uri: this._client.code2ProtocolConverter.asUri(resource),
          type: vscode_languageserver_protocol_1.FileChangeType.Deleted
        }), null, listeners);
      }
    }
    unregister(id) {
      let disposeables = this._watchers.get(id);
      if (disposeables) {
        for (let disposable of disposeables) {
          disposable.dispose();
        }
      }
    }
    dispose() {
      this._watchers.forEach((disposeables) => {
        for (let disposable of disposeables) {
          disposable.dispose();
        }
      });
      this._watchers.clear();
    }
  };
  var TextDocumentFeature = class {
    constructor(_client, _message) {
      this._client = _client;
      this._message = _message;
      this._registrations = new Map();
    }
    get messages() {
      return this._message;
    }
    register(message, data) {
      if (message.method !== this.messages.method) {
        throw new Error(`Register called on wrong feature. Requested ${message.method} but reached feature ${this.messages.method}`);
      }
      if (!data.registerOptions.documentSelector) {
        return;
      }
      let registration = this.registerLanguageProvider(data.registerOptions);
      this._registrations.set(data.id, {disposable: registration[0], data, provider: registration[1]});
    }
    unregister(id) {
      let registration = this._registrations.get(id);
      if (registration !== void 0) {
        registration.disposable.dispose();
      }
    }
    dispose() {
      this._registrations.forEach((value) => {
        value.disposable.dispose();
      });
      this._registrations.clear();
    }
    getRegistration(documentSelector, capability) {
      if (!capability) {
        return [void 0, void 0];
      } else if (vscode_languageserver_protocol_1.TextDocumentRegistrationOptions.is(capability)) {
        const id = vscode_languageserver_protocol_1.StaticRegistrationOptions.hasId(capability) ? capability.id : UUID.generateUuid();
        const selector = capability.documentSelector || documentSelector;
        if (selector) {
          return [id, Object.assign({}, capability, {documentSelector: selector})];
        }
      } else if (Is.boolean(capability) && capability === true || vscode_languageserver_protocol_1.WorkDoneProgressOptions.is(capability)) {
        if (!documentSelector) {
          return [void 0, void 0];
        }
        let options = Is.boolean(capability) && capability === true ? {documentSelector} : Object.assign({}, capability, {documentSelector});
        return [UUID.generateUuid(), options];
      }
      return [void 0, void 0];
    }
    getRegistrationOptions(documentSelector, capability) {
      if (!documentSelector || !capability) {
        return void 0;
      }
      return Is.boolean(capability) && capability === true ? {documentSelector} : Object.assign({}, capability, {documentSelector});
    }
    getProvider(textDocument) {
      for (const registration of this._registrations.values()) {
        let selector = registration.data.registerOptions.documentSelector;
        if (selector !== null && vscode_1.languages.match(selector, textDocument)) {
          return registration.provider;
        }
      }
      throw new Error(`The feature has no registration for the provided text document ${textDocument.uri.toString()}`);
    }
  };
  exports2.TextDocumentFeature = TextDocumentFeature;
  var WorkspaceFeature = class {
    constructor(_client, _message) {
      this._client = _client;
      this._message = _message;
      this._registrations = new Map();
    }
    get messages() {
      return this._message;
    }
    register(message, data) {
      if (message.method !== this.messages.method) {
        throw new Error(`Register called on wron feature. Requested ${message.method} but reached feature ${this.messages.method}`);
      }
      const registration = this.registerLanguageProvider(data.registerOptions);
      this._registrations.set(data.id, {disposable: registration[0], provider: registration[1]});
    }
    unregister(id) {
      let registration = this._registrations.get(id);
      if (registration !== void 0) {
        registration.disposable.dispose();
      }
    }
    dispose() {
      this._registrations.forEach((registration) => {
        registration.disposable.dispose();
      });
      this._registrations.clear();
    }
    getProviders() {
      const result = [];
      for (const registration of this._registrations.values()) {
        result.push(registration.provider);
      }
      return result;
    }
  };
  var CompletionItemFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.CompletionRequest.type);
    }
    fillClientCapabilities(capabilites) {
      let completion = ensure(ensure(capabilites, "textDocument"), "completion");
      completion.dynamicRegistration = true;
      completion.contextSupport = true;
      completion.completionItem = {
        snippetSupport: true,
        commitCharactersSupport: true,
        documentationFormat: [vscode_languageserver_protocol_1.MarkupKind.Markdown, vscode_languageserver_protocol_1.MarkupKind.PlainText],
        deprecatedSupport: true,
        preselectSupport: true,
        tagSupport: {valueSet: [vscode_languageserver_protocol_1.CompletionItemTag.Deprecated]}
      };
      completion.completionItemKind = {valueSet: SupportedCompletionItemKinds};
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.completionProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {
        id: UUID.generateUuid(),
        registerOptions: options
      });
    }
    registerLanguageProvider(options) {
      const triggerCharacters = options.triggerCharacters || [];
      const provider = {
        provideCompletionItems: (document, position, token, context) => {
          const client2 = this._client;
          const middleware = this._client.clientOptions.middleware;
          const provideCompletionItems = (document2, position2, context2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.CompletionRequest.type, client2.code2ProtocolConverter.asCompletionParams(document2, position2, context2), token2).then(client2.protocol2CodeConverter.asCompletionResult, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.CompletionRequest.type, error);
              return Promise.resolve([]);
            });
          };
          return middleware.provideCompletionItem ? middleware.provideCompletionItem(document, position, context, token, provideCompletionItems) : provideCompletionItems(document, position, context, token);
        },
        resolveCompletionItem: options.resolveProvider ? (item, token) => {
          const client2 = this._client;
          const middleware = this._client.clientOptions.middleware;
          const resolveCompletionItem = (item2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.CompletionResolveRequest.type, client2.code2ProtocolConverter.asCompletionItem(item2), token2).then(client2.protocol2CodeConverter.asCompletionItem, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.CompletionResolveRequest.type, error);
              return Promise.resolve(item2);
            });
          };
          return middleware.resolveCompletionItem ? middleware.resolveCompletionItem(item, token, resolveCompletionItem) : resolveCompletionItem(item, token);
        } : void 0
      };
      return [vscode_1.languages.registerCompletionItemProvider(options.documentSelector, provider, ...triggerCharacters), provider];
    }
  };
  var HoverFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.HoverRequest.type);
    }
    fillClientCapabilities(capabilites) {
      const hoverCapability = ensure(ensure(capabilites, "textDocument"), "hover");
      hoverCapability.dynamicRegistration = true;
      hoverCapability.contentFormat = [vscode_languageserver_protocol_1.MarkupKind.Markdown, vscode_languageserver_protocol_1.MarkupKind.PlainText];
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.hoverProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {
        id: UUID.generateUuid(),
        registerOptions: options
      });
    }
    registerLanguageProvider(options) {
      const provider = {
        provideHover: (document, position, token) => {
          const client2 = this._client;
          const provideHover = (document2, position2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.HoverRequest.type, client2.code2ProtocolConverter.asTextDocumentPositionParams(document2, position2), token2).then(client2.protocol2CodeConverter.asHover, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.HoverRequest.type, error);
              return Promise.resolve(null);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideHover ? middleware.provideHover(document, position, token, provideHover) : provideHover(document, position, token);
        }
      };
      return [vscode_1.languages.registerHoverProvider(options.documentSelector, provider), provider];
    }
  };
  var SignatureHelpFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.SignatureHelpRequest.type);
    }
    fillClientCapabilities(capabilites) {
      let config = ensure(ensure(capabilites, "textDocument"), "signatureHelp");
      config.dynamicRegistration = true;
      config.signatureInformation = {documentationFormat: [vscode_languageserver_protocol_1.MarkupKind.Markdown, vscode_languageserver_protocol_1.MarkupKind.PlainText]};
      config.signatureInformation.parameterInformation = {labelOffsetSupport: true};
      config.contextSupport = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.signatureHelpProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {
        id: UUID.generateUuid(),
        registerOptions: options
      });
    }
    registerLanguageProvider(options) {
      const provider = {
        provideSignatureHelp: (document, position, token, context) => {
          const client2 = this._client;
          const providerSignatureHelp = (document2, position2, context2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.SignatureHelpRequest.type, client2.code2ProtocolConverter.asSignatureHelpParams(document2, position2, context2), token2).then(client2.protocol2CodeConverter.asSignatureHelp, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.SignatureHelpRequest.type, error);
              return Promise.resolve(null);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideSignatureHelp ? middleware.provideSignatureHelp(document, position, context, token, providerSignatureHelp) : providerSignatureHelp(document, position, context, token);
        }
      };
      let disposable;
      if (options.retriggerCharacters === void 0) {
        const triggerCharacters = options.triggerCharacters || [];
        disposable = vscode_1.languages.registerSignatureHelpProvider(options.documentSelector, provider, ...triggerCharacters);
      } else {
        const metaData = {
          triggerCharacters: options.triggerCharacters || [],
          retriggerCharacters: options.retriggerCharacters || []
        };
        disposable = vscode_1.languages.registerSignatureHelpProvider(options.documentSelector, provider, metaData);
      }
      return [disposable, provider];
    }
  };
  var DefinitionFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.DefinitionRequest.type);
    }
    fillClientCapabilities(capabilites) {
      let definitionSupport = ensure(ensure(capabilites, "textDocument"), "definition");
      definitionSupport.dynamicRegistration = true;
      definitionSupport.linkSupport = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.definitionProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideDefinition: (document, position, token) => {
          const client2 = this._client;
          const provideDefinition = (document2, position2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.DefinitionRequest.type, client2.code2ProtocolConverter.asTextDocumentPositionParams(document2, position2), token2).then(client2.protocol2CodeConverter.asDefinitionResult, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.DefinitionRequest.type, error);
              return Promise.resolve(null);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideDefinition ? middleware.provideDefinition(document, position, token, provideDefinition) : provideDefinition(document, position, token);
        }
      };
      return [vscode_1.languages.registerDefinitionProvider(options.documentSelector, provider), provider];
    }
  };
  var ReferencesFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.ReferencesRequest.type);
    }
    fillClientCapabilities(capabilites) {
      ensure(ensure(capabilites, "textDocument"), "references").dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.referencesProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideReferences: (document, position, options2, token) => {
          const client2 = this._client;
          const _providerReferences = (document2, position2, options3, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.ReferencesRequest.type, client2.code2ProtocolConverter.asReferenceParams(document2, position2, options3), token2).then(client2.protocol2CodeConverter.asReferences, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.ReferencesRequest.type, error);
              return Promise.resolve([]);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideReferences ? middleware.provideReferences(document, position, options2, token, _providerReferences) : _providerReferences(document, position, options2, token);
        }
      };
      return [vscode_1.languages.registerReferenceProvider(options.documentSelector, provider), provider];
    }
  };
  var DocumentHighlightFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.DocumentHighlightRequest.type);
    }
    fillClientCapabilities(capabilites) {
      ensure(ensure(capabilites, "textDocument"), "documentHighlight").dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.documentHighlightProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideDocumentHighlights: (document, position, token) => {
          const client2 = this._client;
          const _provideDocumentHighlights = (document2, position2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.DocumentHighlightRequest.type, client2.code2ProtocolConverter.asTextDocumentPositionParams(document2, position2), token2).then(client2.protocol2CodeConverter.asDocumentHighlights, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.DocumentHighlightRequest.type, error);
              return Promise.resolve([]);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideDocumentHighlights ? middleware.provideDocumentHighlights(document, position, token, _provideDocumentHighlights) : _provideDocumentHighlights(document, position, token);
        }
      };
      return [vscode_1.languages.registerDocumentHighlightProvider(options.documentSelector, provider), provider];
    }
  };
  var DocumentSymbolFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.DocumentSymbolRequest.type);
    }
    fillClientCapabilities(capabilites) {
      let symbolCapabilities = ensure(ensure(capabilites, "textDocument"), "documentSymbol");
      symbolCapabilities.dynamicRegistration = true;
      symbolCapabilities.symbolKind = {
        valueSet: SupportedSymbolKinds
      };
      symbolCapabilities.hierarchicalDocumentSymbolSupport = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.documentSymbolProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideDocumentSymbols: (document, token) => {
          const client2 = this._client;
          const _provideDocumentSymbols = (document2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, client2.code2ProtocolConverter.asDocumentSymbolParams(document2), token2).then((data) => {
              if (data === null) {
                return void 0;
              }
              if (data.length === 0) {
                return [];
              } else {
                let element = data[0];
                if (vscode_languageserver_protocol_1.DocumentSymbol.is(element)) {
                  return client2.protocol2CodeConverter.asDocumentSymbols(data);
                } else {
                  return client2.protocol2CodeConverter.asSymbolInformations(data);
                }
              }
            }, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, error);
              return Promise.resolve([]);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideDocumentSymbols ? middleware.provideDocumentSymbols(document, token, _provideDocumentSymbols) : _provideDocumentSymbols(document, token);
        }
      };
      return [vscode_1.languages.registerDocumentSymbolProvider(options.documentSelector, provider), provider];
    }
  };
  var WorkspaceSymbolFeature = class extends WorkspaceFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.WorkspaceSymbolRequest.type);
    }
    fillClientCapabilities(capabilites) {
      let symbolCapabilities = ensure(ensure(capabilites, "workspace"), "symbol");
      symbolCapabilities.dynamicRegistration = true;
      symbolCapabilities.symbolKind = {
        valueSet: SupportedSymbolKinds
      };
    }
    initialize(capabilities) {
      if (!capabilities.workspaceSymbolProvider) {
        return;
      }
      this.register(this.messages, {
        id: UUID.generateUuid(),
        registerOptions: capabilities.workspaceSymbolProvider === true ? {workDoneProgress: false} : capabilities.workspaceSymbolProvider
      });
    }
    registerLanguageProvider(_options) {
      const provider = {
        provideWorkspaceSymbols: (query, token) => {
          const client2 = this._client;
          const provideWorkspaceSymbols = (query2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.WorkspaceSymbolRequest.type, {query: query2}, token2).then(client2.protocol2CodeConverter.asSymbolInformations, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.WorkspaceSymbolRequest.type, error);
              return Promise.resolve([]);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideWorkspaceSymbols ? middleware.provideWorkspaceSymbols(query, token, provideWorkspaceSymbols) : provideWorkspaceSymbols(query, token);
        }
      };
      return [vscode_1.languages.registerWorkspaceSymbolProvider(provider), provider];
    }
  };
  var CodeActionFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.CodeActionRequest.type);
    }
    fillClientCapabilities(capabilites) {
      const cap = ensure(ensure(capabilites, "textDocument"), "codeAction");
      cap.dynamicRegistration = true;
      cap.isPreferredSupport = true;
      cap.codeActionLiteralSupport = {
        codeActionKind: {
          valueSet: [
            vscode_languageserver_protocol_1.CodeActionKind.Empty,
            vscode_languageserver_protocol_1.CodeActionKind.QuickFix,
            vscode_languageserver_protocol_1.CodeActionKind.Refactor,
            vscode_languageserver_protocol_1.CodeActionKind.RefactorExtract,
            vscode_languageserver_protocol_1.CodeActionKind.RefactorInline,
            vscode_languageserver_protocol_1.CodeActionKind.RefactorRewrite,
            vscode_languageserver_protocol_1.CodeActionKind.Source,
            vscode_languageserver_protocol_1.CodeActionKind.SourceOrganizeImports
          ]
        }
      };
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.codeActionProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideCodeActions: (document, range, context, token) => {
          const client2 = this._client;
          const _provideCodeActions = (document2, range2, context2, token2) => {
            const params = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2),
              range: client2.code2ProtocolConverter.asRange(range2),
              context: client2.code2ProtocolConverter.asCodeActionContext(context2)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.CodeActionRequest.type, params, token2).then((values) => {
              if (values === null) {
                return void 0;
              }
              const result = [];
              for (let item of values) {
                if (vscode_languageserver_protocol_1.Command.is(item)) {
                  result.push(client2.protocol2CodeConverter.asCommand(item));
                } else {
                  result.push(client2.protocol2CodeConverter.asCodeAction(item));
                }
              }
              return result;
            }, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.CodeActionRequest.type, error);
              return Promise.resolve([]);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideCodeActions ? middleware.provideCodeActions(document, range, context, token, _provideCodeActions) : _provideCodeActions(document, range, context, token);
        }
      };
      return [vscode_1.languages.registerCodeActionsProvider(options.documentSelector, provider, options.codeActionKinds ? {providedCodeActionKinds: this._client.protocol2CodeConverter.asCodeActionKinds(options.codeActionKinds)} : void 0), provider];
    }
  };
  var CodeLensFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.CodeLensRequest.type);
    }
    fillClientCapabilities(capabilites) {
      ensure(ensure(capabilites, "textDocument"), "codeLens").dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.codeLensProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideCodeLenses: (document, token) => {
          const client2 = this._client;
          const provideCodeLenses = (document2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.CodeLensRequest.type, client2.code2ProtocolConverter.asCodeLensParams(document2), token2).then(client2.protocol2CodeConverter.asCodeLenses, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.CodeLensRequest.type, error);
              return Promise.resolve([]);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideCodeLenses ? middleware.provideCodeLenses(document, token, provideCodeLenses) : provideCodeLenses(document, token);
        },
        resolveCodeLens: options.resolveProvider ? (codeLens, token) => {
          const client2 = this._client;
          const resolveCodeLens = (codeLens2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.CodeLensResolveRequest.type, client2.code2ProtocolConverter.asCodeLens(codeLens2), token2).then(client2.protocol2CodeConverter.asCodeLens, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.CodeLensResolveRequest.type, error);
              return codeLens2;
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.resolveCodeLens ? middleware.resolveCodeLens(codeLens, token, resolveCodeLens) : resolveCodeLens(codeLens, token);
        } : void 0
      };
      return [vscode_1.languages.registerCodeLensProvider(options.documentSelector, provider), provider];
    }
  };
  var DocumentFormattingFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.DocumentFormattingRequest.type);
    }
    fillClientCapabilities(capabilites) {
      ensure(ensure(capabilites, "textDocument"), "formatting").dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.documentFormattingProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideDocumentFormattingEdits: (document, options2, token) => {
          const client2 = this._client;
          const provideDocumentFormattingEdits = (document2, options3, token2) => {
            const params = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2),
              options: client2.code2ProtocolConverter.asFormattingOptions(options3)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.DocumentFormattingRequest.type, params, token2).then(client2.protocol2CodeConverter.asTextEdits, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.DocumentFormattingRequest.type, error);
              return Promise.resolve([]);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideDocumentFormattingEdits ? middleware.provideDocumentFormattingEdits(document, options2, token, provideDocumentFormattingEdits) : provideDocumentFormattingEdits(document, options2, token);
        }
      };
      return [vscode_1.languages.registerDocumentFormattingEditProvider(options.documentSelector, provider), provider];
    }
  };
  var DocumentRangeFormattingFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.DocumentRangeFormattingRequest.type);
    }
    fillClientCapabilities(capabilites) {
      ensure(ensure(capabilites, "textDocument"), "rangeFormatting").dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.documentRangeFormattingProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideDocumentRangeFormattingEdits: (document, range, options2, token) => {
          const client2 = this._client;
          const provideDocumentRangeFormattingEdits = (document2, range2, options3, token2) => {
            let params = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2),
              range: client2.code2ProtocolConverter.asRange(range2),
              options: client2.code2ProtocolConverter.asFormattingOptions(options3)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.DocumentRangeFormattingRequest.type, params, token2).then(client2.protocol2CodeConverter.asTextEdits, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.DocumentRangeFormattingRequest.type, error);
              return Promise.resolve([]);
            });
          };
          let middleware = client2.clientOptions.middleware;
          return middleware.provideDocumentRangeFormattingEdits ? middleware.provideDocumentRangeFormattingEdits(document, range, options2, token, provideDocumentRangeFormattingEdits) : provideDocumentRangeFormattingEdits(document, range, options2, token);
        }
      };
      return [vscode_1.languages.registerDocumentRangeFormattingEditProvider(options.documentSelector, provider), provider];
    }
  };
  var DocumentOnTypeFormattingFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.DocumentOnTypeFormattingRequest.type);
    }
    fillClientCapabilities(capabilites) {
      ensure(ensure(capabilites, "textDocument"), "onTypeFormatting").dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.documentOnTypeFormattingProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideOnTypeFormattingEdits: (document, position, ch, options2, token) => {
          const client2 = this._client;
          const provideOnTypeFormattingEdits = (document2, position2, ch2, options3, token2) => {
            let params = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2),
              position: client2.code2ProtocolConverter.asPosition(position2),
              ch: ch2,
              options: client2.code2ProtocolConverter.asFormattingOptions(options3)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.DocumentOnTypeFormattingRequest.type, params, token2).then(client2.protocol2CodeConverter.asTextEdits, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.DocumentOnTypeFormattingRequest.type, error);
              return Promise.resolve([]);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideOnTypeFormattingEdits ? middleware.provideOnTypeFormattingEdits(document, position, ch, options2, token, provideOnTypeFormattingEdits) : provideOnTypeFormattingEdits(document, position, ch, options2, token);
        }
      };
      const moreTriggerCharacter = options.moreTriggerCharacter || [];
      return [vscode_1.languages.registerOnTypeFormattingEditProvider(options.documentSelector, provider, options.firstTriggerCharacter, ...moreTriggerCharacter), provider];
    }
  };
  var RenameFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.RenameRequest.type);
    }
    fillClientCapabilities(capabilites) {
      let rename = ensure(ensure(capabilites, "textDocument"), "rename");
      rename.dynamicRegistration = true;
      rename.prepareSupport = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.renameProvider);
      if (!options) {
        return;
      }
      if (Is.boolean(capabilities.renameProvider)) {
        options.prepareProvider = false;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideRenameEdits: (document, position, newName, token) => {
          const client2 = this._client;
          const provideRenameEdits = (document2, position2, newName2, token2) => {
            let params = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2),
              position: client2.code2ProtocolConverter.asPosition(position2),
              newName: newName2
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.RenameRequest.type, params, token2).then(client2.protocol2CodeConverter.asWorkspaceEdit, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.RenameRequest.type, error);
              return Promise.reject(new Error(error.message));
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideRenameEdits ? middleware.provideRenameEdits(document, position, newName, token, provideRenameEdits) : provideRenameEdits(document, position, newName, token);
        },
        prepareRename: options.prepareProvider ? (document, position, token) => {
          const client2 = this._client;
          const prepareRename = (document2, position2, token2) => {
            let params = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2),
              position: client2.code2ProtocolConverter.asPosition(position2)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.PrepareRenameRequest.type, params, token2).then((result) => {
              if (vscode_languageserver_protocol_1.Range.is(result)) {
                return client2.protocol2CodeConverter.asRange(result);
              } else if (result && vscode_languageserver_protocol_1.Range.is(result.range)) {
                return {
                  range: client2.protocol2CodeConverter.asRange(result.range),
                  placeholder: result.placeholder
                };
              }
              return Promise.reject(new Error(`The element can't be renamed.`));
            }, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.PrepareRenameRequest.type, error);
              return Promise.reject(new Error(error.message));
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.prepareRename ? middleware.prepareRename(document, position, token, prepareRename) : prepareRename(document, position, token);
        } : void 0
      };
      return [vscode_1.languages.registerRenameProvider(options.documentSelector, provider), provider];
    }
  };
  var DocumentLinkFeature = class extends TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.DocumentLinkRequest.type);
    }
    fillClientCapabilities(capabilites) {
      const documentLinkCapabilities = ensure(ensure(capabilites, "textDocument"), "documentLink");
      documentLinkCapabilities.dynamicRegistration = true;
      documentLinkCapabilities.tooltipSupport = true;
    }
    initialize(capabilities, documentSelector) {
      const options = this.getRegistrationOptions(documentSelector, capabilities.documentLinkProvider);
      if (!options) {
        return;
      }
      this.register(this.messages, {id: UUID.generateUuid(), registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideDocumentLinks: (document, token) => {
          const client2 = this._client;
          const provideDocumentLinks = (document2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.DocumentLinkRequest.type, client2.code2ProtocolConverter.asDocumentLinkParams(document2), token2).then(client2.protocol2CodeConverter.asDocumentLinks, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.DocumentLinkRequest.type, error);
              return Promise.resolve([]);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideDocumentLinks ? middleware.provideDocumentLinks(document, token, provideDocumentLinks) : provideDocumentLinks(document, token);
        },
        resolveDocumentLink: options.resolveProvider ? (link, token) => {
          const client2 = this._client;
          let resolveDocumentLink = (link2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.DocumentLinkResolveRequest.type, client2.code2ProtocolConverter.asDocumentLink(link2), token2).then(client2.protocol2CodeConverter.asDocumentLink, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.DocumentLinkResolveRequest.type, error);
              return Promise.resolve(link2);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.resolveDocumentLink ? middleware.resolveDocumentLink(link, token, resolveDocumentLink) : resolveDocumentLink(link, token);
        } : void 0
      };
      return [vscode_1.languages.registerDocumentLinkProvider(options.documentSelector, provider), provider];
    }
  };
  var ConfigurationFeature = class {
    constructor(_client) {
      this._client = _client;
      this._listeners = new Map();
    }
    get messages() {
      return vscode_languageserver_protocol_1.DidChangeConfigurationNotification.type;
    }
    fillClientCapabilities(capabilities) {
      ensure(ensure(capabilities, "workspace"), "didChangeConfiguration").dynamicRegistration = true;
    }
    initialize() {
      let section = this._client.clientOptions.synchronize.configurationSection;
      if (section !== void 0) {
        this.register(this.messages, {
          id: UUID.generateUuid(),
          registerOptions: {
            section
          }
        });
      }
    }
    register(_message, data) {
      let disposable = vscode_1.workspace.onDidChangeConfiguration((event) => {
        this.onDidChangeConfiguration(data.registerOptions.section, event);
      });
      this._listeners.set(data.id, disposable);
      if (data.registerOptions.section !== void 0) {
        this.onDidChangeConfiguration(data.registerOptions.section, void 0);
      }
    }
    unregister(id) {
      let disposable = this._listeners.get(id);
      if (disposable) {
        this._listeners.delete(id);
        disposable.dispose();
      }
    }
    dispose() {
      for (let disposable of this._listeners.values()) {
        disposable.dispose();
      }
      this._listeners.clear();
    }
    onDidChangeConfiguration(configurationSection, event) {
      let sections;
      if (Is.string(configurationSection)) {
        sections = [configurationSection];
      } else {
        sections = configurationSection;
      }
      if (sections !== void 0 && event !== void 0) {
        let affected = sections.some((section) => event.affectsConfiguration(section));
        if (!affected) {
          return;
        }
      }
      let didChangeConfiguration = (sections2) => {
        if (sections2 === void 0) {
          this._client.sendNotification(vscode_languageserver_protocol_1.DidChangeConfigurationNotification.type, {settings: null});
          return;
        }
        this._client.sendNotification(vscode_languageserver_protocol_1.DidChangeConfigurationNotification.type, {settings: this.extractSettingsInformation(sections2)});
      };
      let middleware = this.getMiddleware();
      middleware ? middleware(sections, didChangeConfiguration) : didChangeConfiguration(sections);
    }
    extractSettingsInformation(keys) {
      function ensurePath(config, path) {
        let current = config;
        for (let i = 0; i < path.length - 1; i++) {
          let obj = current[path[i]];
          if (!obj) {
            obj = Object.create(null);
            current[path[i]] = obj;
          }
          current = obj;
        }
        return current;
      }
      let resource = this._client.clientOptions.workspaceFolder ? this._client.clientOptions.workspaceFolder.uri : void 0;
      let result = Object.create(null);
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let index = key.indexOf(".");
        let config = null;
        if (index >= 0) {
          config = vscode_1.workspace.getConfiguration(key.substr(0, index), resource).get(key.substr(index + 1));
        } else {
          config = vscode_1.workspace.getConfiguration(key, resource);
        }
        if (config) {
          let path = keys[i].split(".");
          ensurePath(result, path)[path[path.length - 1]] = config;
        }
      }
      return result;
    }
    getMiddleware() {
      let middleware = this._client.clientOptions.middleware;
      if (middleware.workspace && middleware.workspace.didChangeConfiguration) {
        return middleware.workspace.didChangeConfiguration;
      } else {
        return void 0;
      }
    }
  };
  var ExecuteCommandFeature = class {
    constructor(_client) {
      this._client = _client;
      this._commands = new Map();
    }
    get messages() {
      return vscode_languageserver_protocol_1.ExecuteCommandRequest.type;
    }
    fillClientCapabilities(capabilities) {
      ensure(ensure(capabilities, "workspace"), "executeCommand").dynamicRegistration = true;
    }
    initialize(capabilities) {
      if (!capabilities.executeCommandProvider) {
        return;
      }
      this.register(this.messages, {
        id: UUID.generateUuid(),
        registerOptions: Object.assign({}, capabilities.executeCommandProvider)
      });
    }
    register(_message, data) {
      const client2 = this._client;
      const middleware = client2.clientOptions.middleware;
      const executeCommand = (command, args) => {
        let params = {
          command,
          arguments: args
        };
        return client2.sendRequest(vscode_languageserver_protocol_1.ExecuteCommandRequest.type, params).then(void 0, (error) => {
          client2.logFailedRequest(vscode_languageserver_protocol_1.ExecuteCommandRequest.type, error);
        });
      };
      if (data.registerOptions.commands) {
        const disposeables = [];
        for (const command of data.registerOptions.commands) {
          disposeables.push(vscode_1.commands.registerCommand(command, (...args) => {
            return middleware.executeCommand ? middleware.executeCommand(command, args, executeCommand) : executeCommand(command, args);
          }));
        }
        this._commands.set(data.id, disposeables);
      }
    }
    unregister(id) {
      let disposeables = this._commands.get(id);
      if (disposeables) {
        disposeables.forEach((disposable) => disposable.dispose());
      }
    }
    dispose() {
      this._commands.forEach((value) => {
        value.forEach((disposable) => disposable.dispose());
      });
      this._commands.clear();
    }
  };
  var MessageTransports;
  (function(MessageTransports2) {
    function is(value) {
      let candidate = value;
      return candidate && vscode_languageserver_protocol_1.MessageReader.is(value.reader) && vscode_languageserver_protocol_1.MessageWriter.is(value.writer);
    }
    MessageTransports2.is = is;
  })(MessageTransports = exports2.MessageTransports || (exports2.MessageTransports = {}));
  var OnReady = class {
    constructor(_resolve, _reject) {
      this._resolve = _resolve;
      this._reject = _reject;
      this._used = false;
    }
    get isUsed() {
      return this._used;
    }
    resolve() {
      this._used = true;
      this._resolve();
    }
    reject(error) {
      this._used = true;
      this._reject(error);
    }
  };
  var BaseLanguageClient = class {
    constructor(id, name, clientOptions) {
      this._traceFormat = vscode_languageserver_protocol_1.TraceFormat.Text;
      this._features = [];
      this._method2Message = new Map();
      this._dynamicFeatures = new Map();
      this._id = id;
      this._name = name;
      clientOptions = clientOptions || {};
      this._clientOptions = {
        documentSelector: clientOptions.documentSelector || [],
        synchronize: clientOptions.synchronize || {},
        diagnosticCollectionName: clientOptions.diagnosticCollectionName,
        outputChannelName: clientOptions.outputChannelName || this._name,
        revealOutputChannelOn: clientOptions.revealOutputChannelOn || RevealOutputChannelOn.Error,
        stdioEncoding: clientOptions.stdioEncoding || "utf8",
        initializationOptions: clientOptions.initializationOptions,
        initializationFailedHandler: clientOptions.initializationFailedHandler,
        progressOnInitialization: !!clientOptions.progressOnInitialization,
        errorHandler: clientOptions.errorHandler || new DefaultErrorHandler(this._name),
        middleware: clientOptions.middleware || {},
        uriConverters: clientOptions.uriConverters,
        workspaceFolder: clientOptions.workspaceFolder
      };
      this._clientOptions.synchronize = this._clientOptions.synchronize || {};
      this.state = ClientState.Initial;
      this._connectionPromise = void 0;
      this._resolvedConnection = void 0;
      this._initializeResult = void 0;
      if (clientOptions.outputChannel) {
        this._outputChannel = clientOptions.outputChannel;
        this._disposeOutputChannel = false;
      } else {
        this._outputChannel = void 0;
        this._disposeOutputChannel = true;
      }
      this._traceOutputChannel = clientOptions.traceOutputChannel;
      this._listeners = void 0;
      this._providers = void 0;
      this._diagnostics = void 0;
      this._fileEvents = [];
      this._fileEventDelayer = new async_1.Delayer(250);
      this._onReady = new Promise((resolve, reject) => {
        this._onReadyCallbacks = new OnReady(resolve, reject);
      });
      this._onStop = void 0;
      this._telemetryEmitter = new vscode_languageserver_protocol_1.Emitter();
      this._stateChangeEmitter = new vscode_languageserver_protocol_1.Emitter();
      this._tracer = {
        log: (messageOrDataObject, data) => {
          if (Is.string(messageOrDataObject)) {
            this.logTrace(messageOrDataObject, data);
          } else {
            this.logObjectTrace(messageOrDataObject);
          }
        }
      };
      this._c2p = c2p.createConverter(clientOptions.uriConverters ? clientOptions.uriConverters.code2Protocol : void 0);
      this._p2c = p2c.createConverter(clientOptions.uriConverters ? clientOptions.uriConverters.protocol2Code : void 0);
      this._syncedDocuments = new Map();
      this.registerBuiltinFeatures();
    }
    get state() {
      return this._state;
    }
    set state(value) {
      let oldState = this.getPublicState();
      this._state = value;
      let newState = this.getPublicState();
      if (newState !== oldState) {
        this._stateChangeEmitter.fire({oldState, newState});
      }
    }
    getPublicState() {
      if (this.state === ClientState.Running) {
        return State.Running;
      } else if (this.state === ClientState.Starting) {
        return State.Starting;
      } else {
        return State.Stopped;
      }
    }
    get initializeResult() {
      return this._initializeResult;
    }
    sendRequest(type, ...params) {
      if (!this.isConnectionActive()) {
        throw new Error("Language client is not ready yet");
      }
      this.forceDocumentSync();
      try {
        return this._resolvedConnection.sendRequest(type, ...params);
      } catch (error) {
        this.error(`Sending request ${Is.string(type) ? type : type.method} failed.`, error);
        throw error;
      }
    }
    onRequest(type, handler) {
      if (!this.isConnectionActive()) {
        throw new Error("Language client is not ready yet");
      }
      try {
        this._resolvedConnection.onRequest(type, handler);
      } catch (error) {
        this.error(`Registering request handler ${Is.string(type) ? type : type.method} failed.`, error);
        throw error;
      }
    }
    sendNotification(type, params) {
      if (!this.isConnectionActive()) {
        throw new Error("Language client is not ready yet");
      }
      this.forceDocumentSync();
      try {
        this._resolvedConnection.sendNotification(type, params);
      } catch (error) {
        this.error(`Sending notification ${Is.string(type) ? type : type.method} failed.`, error);
        throw error;
      }
    }
    onNotification(type, handler) {
      if (!this.isConnectionActive()) {
        throw new Error("Language client is not ready yet");
      }
      try {
        this._resolvedConnection.onNotification(type, handler);
      } catch (error) {
        this.error(`Registering notification handler ${Is.string(type) ? type : type.method} failed.`, error);
        throw error;
      }
    }
    onProgress(type, token, handler) {
      if (!this.isConnectionActive()) {
        throw new Error("Language client is not ready yet");
      }
      try {
        return this._resolvedConnection.onProgress(type, token, handler);
      } catch (error) {
        this.error(`Registering progress handler for token ${token} failed.`, error);
        throw error;
      }
    }
    sendProgress(type, token, value) {
      if (!this.isConnectionActive()) {
        throw new Error("Language client is not ready yet");
      }
      this.forceDocumentSync();
      try {
        this._resolvedConnection.sendProgress(type, token, value);
      } catch (error) {
        this.error(`Sending progress for token ${token} failed.`, error);
        throw error;
      }
    }
    get clientOptions() {
      return this._clientOptions;
    }
    get protocol2CodeConverter() {
      return this._p2c;
    }
    get code2ProtocolConverter() {
      return this._c2p;
    }
    get onTelemetry() {
      return this._telemetryEmitter.event;
    }
    get onDidChangeState() {
      return this._stateChangeEmitter.event;
    }
    get outputChannel() {
      if (!this._outputChannel) {
        this._outputChannel = vscode_1.window.createOutputChannel(this._clientOptions.outputChannelName ? this._clientOptions.outputChannelName : this._name);
      }
      return this._outputChannel;
    }
    get traceOutputChannel() {
      if (this._traceOutputChannel) {
        return this._traceOutputChannel;
      }
      return this.outputChannel;
    }
    get diagnostics() {
      return this._diagnostics;
    }
    createDefaultErrorHandler() {
      return new DefaultErrorHandler(this._name);
    }
    set trace(value) {
      this._trace = value;
      this.onReady().then(() => {
        this.resolveConnection().then((connection) => {
          connection.trace(this._trace, this._tracer, {
            sendNotification: false,
            traceFormat: this._traceFormat
          });
        });
      }, () => {
      });
    }
    data2String(data) {
      if (data instanceof vscode_languageserver_protocol_1.ResponseError) {
        const responseError = data;
        return `  Message: ${responseError.message}
  Code: ${responseError.code} ${responseError.data ? "\n" + responseError.data.toString() : ""}`;
      }
      if (data instanceof Error) {
        if (Is.string(data.stack)) {
          return data.stack;
        }
        return data.message;
      }
      if (Is.string(data)) {
        return data;
      }
      return data.toString();
    }
    info(message, data, showNotification = true) {
      this.outputChannel.appendLine(`[Info  - ${new Date().toLocaleTimeString()}] ${message}`);
      if (data) {
        this.outputChannel.appendLine(this.data2String(data));
      }
      if (showNotification && this._clientOptions.revealOutputChannelOn <= RevealOutputChannelOn.Info) {
        this.showNotificationMessage();
      }
    }
    warn(message, data, showNotification = true) {
      this.outputChannel.appendLine(`[Warn  - ${new Date().toLocaleTimeString()}] ${message}`);
      if (data) {
        this.outputChannel.appendLine(this.data2String(data));
      }
      if (showNotification && this._clientOptions.revealOutputChannelOn <= RevealOutputChannelOn.Warn) {
        this.showNotificationMessage();
      }
    }
    error(message, data, showNotification = true) {
      this.outputChannel.appendLine(`[Error - ${new Date().toLocaleTimeString()}] ${message}`);
      if (data) {
        this.outputChannel.appendLine(this.data2String(data));
      }
      if (showNotification && this._clientOptions.revealOutputChannelOn <= RevealOutputChannelOn.Error) {
        this.showNotificationMessage();
      }
    }
    showNotificationMessage() {
      vscode_1.window.showInformationMessage("A request has failed. See the output for more information.", "Go to output").then(() => {
        this.outputChannel.show(true);
      });
    }
    logTrace(message, data) {
      this.traceOutputChannel.appendLine(`[Trace - ${new Date().toLocaleTimeString()}] ${message}`);
      if (data) {
        this.traceOutputChannel.appendLine(this.data2String(data));
      }
    }
    logObjectTrace(data) {
      if (data.isLSPMessage && data.type) {
        this.traceOutputChannel.append(`[LSP   - ${new Date().toLocaleTimeString()}] `);
      } else {
        this.traceOutputChannel.append(`[Trace - ${new Date().toLocaleTimeString()}] `);
      }
      if (data) {
        this.traceOutputChannel.appendLine(`${JSON.stringify(data)}`);
      }
    }
    needsStart() {
      return this.state === ClientState.Initial || this.state === ClientState.Stopping || this.state === ClientState.Stopped;
    }
    needsStop() {
      return this.state === ClientState.Starting || this.state === ClientState.Running;
    }
    onReady() {
      return this._onReady;
    }
    isConnectionActive() {
      return this.state === ClientState.Running && !!this._resolvedConnection;
    }
    start() {
      if (this._onReadyCallbacks.isUsed) {
        this._onReady = new Promise((resolve, reject) => {
          this._onReadyCallbacks = new OnReady(resolve, reject);
        });
      }
      this._listeners = [];
      this._providers = [];
      if (!this._diagnostics) {
        this._diagnostics = this._clientOptions.diagnosticCollectionName ? vscode_1.languages.createDiagnosticCollection(this._clientOptions.diagnosticCollectionName) : vscode_1.languages.createDiagnosticCollection();
      }
      this.state = ClientState.Starting;
      this.resolveConnection().then((connection) => {
        connection.onLogMessage((message) => {
          switch (message.type) {
            case vscode_languageserver_protocol_1.MessageType.Error:
              this.error(message.message, void 0, false);
              break;
            case vscode_languageserver_protocol_1.MessageType.Warning:
              this.warn(message.message, void 0, false);
              break;
            case vscode_languageserver_protocol_1.MessageType.Info:
              this.info(message.message, void 0, false);
              break;
            default:
              this.outputChannel.appendLine(message.message);
          }
        });
        connection.onShowMessage((message) => {
          switch (message.type) {
            case vscode_languageserver_protocol_1.MessageType.Error:
              vscode_1.window.showErrorMessage(message.message);
              break;
            case vscode_languageserver_protocol_1.MessageType.Warning:
              vscode_1.window.showWarningMessage(message.message);
              break;
            case vscode_languageserver_protocol_1.MessageType.Info:
              vscode_1.window.showInformationMessage(message.message);
              break;
            default:
              vscode_1.window.showInformationMessage(message.message);
          }
        });
        connection.onRequest(vscode_languageserver_protocol_1.ShowMessageRequest.type, (params) => {
          let messageFunc;
          switch (params.type) {
            case vscode_languageserver_protocol_1.MessageType.Error:
              messageFunc = vscode_1.window.showErrorMessage;
              break;
            case vscode_languageserver_protocol_1.MessageType.Warning:
              messageFunc = vscode_1.window.showWarningMessage;
              break;
            case vscode_languageserver_protocol_1.MessageType.Info:
              messageFunc = vscode_1.window.showInformationMessage;
              break;
            default:
              messageFunc = vscode_1.window.showInformationMessage;
          }
          let actions = params.actions || [];
          return messageFunc(params.message, ...actions);
        });
        connection.onTelemetry((data) => {
          this._telemetryEmitter.fire(data);
        });
        connection.listen();
        return this.initialize(connection);
      }).then(void 0, (error) => {
        this.state = ClientState.StartFailed;
        this._onReadyCallbacks.reject(error);
        this.error("Starting client failed", error);
        vscode_1.window.showErrorMessage(`Couldn't start client ${this._name}`);
      });
      return new vscode_1.Disposable(() => {
        if (this.needsStop()) {
          this.stop();
        }
      });
    }
    resolveConnection() {
      if (!this._connectionPromise) {
        this._connectionPromise = this.createConnection();
      }
      return this._connectionPromise;
    }
    initialize(connection) {
      this.refreshTrace(connection, false);
      let initOption = this._clientOptions.initializationOptions;
      let rootPath = this._clientOptions.workspaceFolder ? this._clientOptions.workspaceFolder.uri.fsPath : this._clientGetRootPath();
      let initParams = {
        processId: process.pid,
        clientInfo: {
          name: "vscode",
          version: vscode_1.version
        },
        rootPath: rootPath ? rootPath : null,
        rootUri: rootPath ? this._c2p.asUri(vscode_1.Uri.file(rootPath)) : null,
        capabilities: this.computeClientCapabilities(),
        initializationOptions: Is.func(initOption) ? initOption() : initOption,
        trace: vscode_languageserver_protocol_1.Trace.toString(this._trace),
        workspaceFolders: null
      };
      this.fillInitializeParams(initParams);
      if (this._clientOptions.progressOnInitialization) {
        const token = UUID.generateUuid();
        const part = new progressPart_1.ProgressPart(connection, token);
        initParams.workDoneToken = token;
        return this.doInitialize(connection, initParams).then((result) => {
          part.done();
          return result;
        }, (error) => {
          part.cancel();
          throw error;
        });
      } else {
        return this.doInitialize(connection, initParams);
      }
    }
    doInitialize(connection, initParams) {
      return connection.initialize(initParams).then((result) => {
        this._resolvedConnection = connection;
        this._initializeResult = result;
        this.state = ClientState.Running;
        let textDocumentSyncOptions = void 0;
        if (Is.number(result.capabilities.textDocumentSync)) {
          if (result.capabilities.textDocumentSync === vscode_languageserver_protocol_1.TextDocumentSyncKind.None) {
            textDocumentSyncOptions = {
              openClose: false,
              change: vscode_languageserver_protocol_1.TextDocumentSyncKind.None,
              save: void 0
            };
          } else {
            textDocumentSyncOptions = {
              openClose: true,
              change: result.capabilities.textDocumentSync,
              save: {
                includeText: false
              }
            };
          }
        } else if (result.capabilities.textDocumentSync !== void 0 && result.capabilities.textDocumentSync !== null) {
          textDocumentSyncOptions = result.capabilities.textDocumentSync;
        }
        this._capabilities = Object.assign({}, result.capabilities, {resolvedTextDocumentSync: textDocumentSyncOptions});
        connection.onDiagnostics((params) => this.handleDiagnostics(params));
        connection.onRequest(vscode_languageserver_protocol_1.RegistrationRequest.type, (params) => this.handleRegistrationRequest(params));
        connection.onRequest("client/registerFeature", (params) => this.handleRegistrationRequest(params));
        connection.onRequest(vscode_languageserver_protocol_1.UnregistrationRequest.type, (params) => this.handleUnregistrationRequest(params));
        connection.onRequest("client/unregisterFeature", (params) => this.handleUnregistrationRequest(params));
        connection.onRequest(vscode_languageserver_protocol_1.ApplyWorkspaceEditRequest.type, (params) => this.handleApplyWorkspaceEdit(params));
        connection.sendNotification(vscode_languageserver_protocol_1.InitializedNotification.type, {});
        this.hookFileEvents(connection);
        this.hookConfigurationChanged(connection);
        this.initializeFeatures(connection);
        this._onReadyCallbacks.resolve();
        return result;
      }).then(void 0, (error) => {
        if (this._clientOptions.initializationFailedHandler) {
          if (this._clientOptions.initializationFailedHandler(error)) {
            this.initialize(connection);
          } else {
            this.stop();
            this._onReadyCallbacks.reject(error);
          }
        } else if (error instanceof vscode_languageserver_protocol_1.ResponseError && error.data && error.data.retry) {
          vscode_1.window.showErrorMessage(error.message, {title: "Retry", id: "retry"}).then((item) => {
            if (item && item.id === "retry") {
              this.initialize(connection);
            } else {
              this.stop();
              this._onReadyCallbacks.reject(error);
            }
          });
        } else {
          if (error && error.message) {
            vscode_1.window.showErrorMessage(error.message);
          }
          this.error("Server initialization failed.", error);
          this.stop();
          this._onReadyCallbacks.reject(error);
        }
        throw error;
      });
    }
    _clientGetRootPath() {
      let folders = vscode_1.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        return void 0;
      }
      let folder = folders[0];
      if (folder.uri.scheme === "file") {
        return folder.uri.fsPath;
      }
      return void 0;
    }
    stop() {
      this._initializeResult = void 0;
      if (!this._connectionPromise) {
        this.state = ClientState.Stopped;
        return Promise.resolve();
      }
      if (this.state === ClientState.Stopping && this._onStop) {
        return this._onStop;
      }
      this.state = ClientState.Stopping;
      this.cleanUp(false);
      return this._onStop = this.resolveConnection().then((connection) => {
        return connection.shutdown().then(() => {
          connection.exit();
          connection.dispose();
          this.state = ClientState.Stopped;
          this.cleanUpChannel();
          this._onStop = void 0;
          this._connectionPromise = void 0;
          this._resolvedConnection = void 0;
        });
      });
    }
    cleanUp(channel = true, diagnostics = true) {
      if (this._listeners) {
        this._listeners.forEach((listener) => listener.dispose());
        this._listeners = void 0;
      }
      if (this._providers) {
        this._providers.forEach((provider) => provider.dispose());
        this._providers = void 0;
      }
      if (this._syncedDocuments) {
        this._syncedDocuments.clear();
      }
      for (let handler of this._dynamicFeatures.values()) {
        handler.dispose();
      }
      if (channel) {
        this.cleanUpChannel();
      }
      if (diagnostics && this._diagnostics) {
        this._diagnostics.dispose();
        this._diagnostics = void 0;
      }
    }
    cleanUpChannel() {
      if (this._outputChannel && this._disposeOutputChannel) {
        this._outputChannel.dispose();
        this._outputChannel = void 0;
      }
    }
    notifyFileEvent(event) {
      var _a, _b;
      const client2 = this;
      function didChangeWatchedFile(event2) {
        client2._fileEvents.push(event2);
        client2._fileEventDelayer.trigger(() => {
          client2.onReady().then(() => {
            client2.resolveConnection().then((connection) => {
              if (client2.isConnectionActive()) {
                client2.forceDocumentSync();
                connection.didChangeWatchedFiles({changes: client2._fileEvents});
              }
              client2._fileEvents = [];
            });
          }, (error) => {
            client2.error(`Notify file events failed.`, error);
          });
        });
      }
      const workSpaceMiddleware = (_a = this.clientOptions.middleware) === null || _a === void 0 ? void 0 : _a.workspace;
      ((_b = workSpaceMiddleware) === null || _b === void 0 ? void 0 : _b.didChangeWatchedFile) ? workSpaceMiddleware.didChangeWatchedFile(event, didChangeWatchedFile) : didChangeWatchedFile(event);
    }
    forceDocumentSync() {
      this._dynamicFeatures.get(vscode_languageserver_protocol_1.DidChangeTextDocumentNotification.type.method).forceDelivery();
    }
    handleDiagnostics(params) {
      if (!this._diagnostics) {
        return;
      }
      let uri = this._p2c.asUri(params.uri);
      let diagnostics = this._p2c.asDiagnostics(params.diagnostics);
      let middleware = this.clientOptions.middleware;
      if (middleware.handleDiagnostics) {
        middleware.handleDiagnostics(uri, diagnostics, (uri2, diagnostics2) => this.setDiagnostics(uri2, diagnostics2));
      } else {
        this.setDiagnostics(uri, diagnostics);
      }
    }
    setDiagnostics(uri, diagnostics) {
      if (!this._diagnostics) {
        return;
      }
      this._diagnostics.set(uri, diagnostics);
    }
    createConnection() {
      let errorHandler = (error, message, count) => {
        this.handleConnectionError(error, message, count);
      };
      let closeHandler = () => {
        this.handleConnectionClosed();
      };
      return this.createMessageTransports(this._clientOptions.stdioEncoding || "utf8").then((transports) => {
        return createConnection(transports.reader, transports.writer, errorHandler, closeHandler);
      });
    }
    handleConnectionClosed() {
      if (this.state === ClientState.Stopping || this.state === ClientState.Stopped) {
        return;
      }
      try {
        if (this._resolvedConnection) {
          this._resolvedConnection.dispose();
        }
      } catch (error) {
      }
      let action = CloseAction.DoNotRestart;
      try {
        action = this._clientOptions.errorHandler.closed();
      } catch (error) {
      }
      this._connectionPromise = void 0;
      this._resolvedConnection = void 0;
      if (action === CloseAction.DoNotRestart) {
        this.error("Connection to server got closed. Server will not be restarted.");
        this.state = ClientState.Stopped;
        this.cleanUp(false, true);
      } else if (action === CloseAction.Restart) {
        this.info("Connection to server got closed. Server will restart.");
        this.cleanUp(false, false);
        this.state = ClientState.Initial;
        this.start();
      }
    }
    handleConnectionError(error, message, count) {
      let action = this._clientOptions.errorHandler.error(error, message, count);
      if (action === ErrorAction.Shutdown) {
        this.error("Connection to server is erroring. Shutting down server.");
        this.stop();
      }
    }
    hookConfigurationChanged(connection) {
      vscode_1.workspace.onDidChangeConfiguration(() => {
        this.refreshTrace(connection, true);
      });
    }
    refreshTrace(connection, sendNotification = false) {
      let config = vscode_1.workspace.getConfiguration(this._id);
      let trace = vscode_languageserver_protocol_1.Trace.Off;
      let traceFormat = vscode_languageserver_protocol_1.TraceFormat.Text;
      if (config) {
        const traceConfig = config.get("trace.server", "off");
        if (typeof traceConfig === "string") {
          trace = vscode_languageserver_protocol_1.Trace.fromString(traceConfig);
        } else {
          trace = vscode_languageserver_protocol_1.Trace.fromString(config.get("trace.server.verbosity", "off"));
          traceFormat = vscode_languageserver_protocol_1.TraceFormat.fromString(config.get("trace.server.format", "text"));
        }
      }
      this._trace = trace;
      this._traceFormat = traceFormat;
      connection.trace(this._trace, this._tracer, {
        sendNotification,
        traceFormat: this._traceFormat
      });
    }
    hookFileEvents(_connection) {
      let fileEvents = this._clientOptions.synchronize.fileEvents;
      if (!fileEvents) {
        return;
      }
      let watchers;
      if (Is.array(fileEvents)) {
        watchers = fileEvents;
      } else {
        watchers = [fileEvents];
      }
      if (!watchers) {
        return;
      }
      this._dynamicFeatures.get(vscode_languageserver_protocol_1.DidChangeWatchedFilesNotification.type.method).registerRaw(UUID.generateUuid(), watchers);
    }
    registerFeatures(features) {
      for (let feature of features) {
        this.registerFeature(feature);
      }
    }
    registerFeature(feature) {
      this._features.push(feature);
      if (DynamicFeature.is(feature)) {
        let messages = feature.messages;
        if (Array.isArray(messages)) {
          for (let message of messages) {
            this._method2Message.set(message.method, message);
            this._dynamicFeatures.set(message.method, feature);
          }
        } else {
          this._method2Message.set(messages.method, messages);
          this._dynamicFeatures.set(messages.method, feature);
        }
      }
    }
    getFeature(request) {
      return this._dynamicFeatures.get(request);
    }
    registerBuiltinFeatures() {
      this.registerFeature(new ConfigurationFeature(this));
      this.registerFeature(new DidOpenTextDocumentFeature(this, this._syncedDocuments));
      this.registerFeature(new DidChangeTextDocumentFeature(this));
      this.registerFeature(new WillSaveFeature(this));
      this.registerFeature(new WillSaveWaitUntilFeature(this));
      this.registerFeature(new DidSaveTextDocumentFeature(this));
      this.registerFeature(new DidCloseTextDocumentFeature(this, this._syncedDocuments));
      this.registerFeature(new FileSystemWatcherFeature(this, (event) => this.notifyFileEvent(event)));
      this.registerFeature(new CompletionItemFeature(this));
      this.registerFeature(new HoverFeature(this));
      this.registerFeature(new SignatureHelpFeature(this));
      this.registerFeature(new DefinitionFeature(this));
      this.registerFeature(new ReferencesFeature(this));
      this.registerFeature(new DocumentHighlightFeature(this));
      this.registerFeature(new DocumentSymbolFeature(this));
      this.registerFeature(new WorkspaceSymbolFeature(this));
      this.registerFeature(new CodeActionFeature(this));
      this.registerFeature(new CodeLensFeature(this));
      this.registerFeature(new DocumentFormattingFeature(this));
      this.registerFeature(new DocumentRangeFormattingFeature(this));
      this.registerFeature(new DocumentOnTypeFormattingFeature(this));
      this.registerFeature(new RenameFeature(this));
      this.registerFeature(new DocumentLinkFeature(this));
      this.registerFeature(new ExecuteCommandFeature(this));
    }
    fillInitializeParams(params) {
      for (let feature of this._features) {
        if (Is.func(feature.fillInitializeParams)) {
          feature.fillInitializeParams(params);
        }
      }
    }
    computeClientCapabilities() {
      let result = {};
      ensure(result, "workspace").applyEdit = true;
      let workspaceEdit = ensure(ensure(result, "workspace"), "workspaceEdit");
      workspaceEdit.documentChanges = true;
      workspaceEdit.resourceOperations = [vscode_languageserver_protocol_1.ResourceOperationKind.Create, vscode_languageserver_protocol_1.ResourceOperationKind.Rename, vscode_languageserver_protocol_1.ResourceOperationKind.Delete];
      workspaceEdit.failureHandling = vscode_languageserver_protocol_1.FailureHandlingKind.TextOnlyTransactional;
      let diagnostics = ensure(ensure(result, "textDocument"), "publishDiagnostics");
      diagnostics.relatedInformation = true;
      diagnostics.versionSupport = false;
      diagnostics.tagSupport = {valueSet: [vscode_languageserver_protocol_1.DiagnosticTag.Unnecessary, vscode_languageserver_protocol_1.DiagnosticTag.Deprecated]};
      for (let feature of this._features) {
        feature.fillClientCapabilities(result);
      }
      return result;
    }
    initializeFeatures(_connection) {
      let documentSelector = this._clientOptions.documentSelector;
      for (let feature of this._features) {
        feature.initialize(this._capabilities, documentSelector);
      }
    }
    handleRegistrationRequest(params) {
      return new Promise((resolve, reject) => {
        for (let registration of params.registrations) {
          const feature = this._dynamicFeatures.get(registration.method);
          if (!feature) {
            reject(new Error(`No feature implementation for ${registration.method} found. Registration failed.`));
            return;
          }
          const options = registration.registerOptions || {};
          options.documentSelector = options.documentSelector || this._clientOptions.documentSelector;
          const data = {
            id: registration.id,
            registerOptions: options
          };
          feature.register(this._method2Message.get(registration.method), data);
        }
        resolve();
      });
    }
    handleUnregistrationRequest(params) {
      return new Promise((resolve, reject) => {
        for (let unregistration of params.unregisterations) {
          const feature = this._dynamicFeatures.get(unregistration.method);
          if (!feature) {
            reject(new Error(`No feature implementation for ${unregistration.method} found. Unregistration failed.`));
            return;
          }
          feature.unregister(unregistration.id);
        }
        resolve();
      });
    }
    handleApplyWorkspaceEdit(params) {
      let workspaceEdit = params.edit;
      let openTextDocuments = new Map();
      vscode_1.workspace.textDocuments.forEach((document) => openTextDocuments.set(document.uri.toString(), document));
      let versionMismatch = false;
      if (workspaceEdit.documentChanges) {
        for (const change of workspaceEdit.documentChanges) {
          if (vscode_languageserver_protocol_1.TextDocumentEdit.is(change) && change.textDocument.version && change.textDocument.version >= 0) {
            let textDocument = openTextDocuments.get(change.textDocument.uri);
            if (textDocument && textDocument.version !== change.textDocument.version) {
              versionMismatch = true;
              break;
            }
          }
        }
      }
      if (versionMismatch) {
        return Promise.resolve({applied: false});
      }
      return Is.asPromise(vscode_1.workspace.applyEdit(this._p2c.asWorkspaceEdit(params.edit)).then((value) => {
        return {applied: value};
      }));
    }
    logFailedRequest(type, error) {
      if (error instanceof vscode_languageserver_protocol_1.ResponseError && (error.code === vscode_languageserver_protocol_1.ErrorCodes.RequestCancelled || error.code === vscode_languageserver_protocol_1.ErrorCodes.ContentModified)) {
        return;
      }
      this.error(`Request ${type.method} failed.`, error);
    }
  };
  exports2.BaseLanguageClient = BaseLanguageClient;
});

// node_modules/vscode-languageclient/lib/colorProvider.js
var require_colorProvider = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var client_1 = require_client();
  function ensure(target, key) {
    if (target[key] === void 0) {
      target[key] = {};
    }
    return target[key];
  }
  var ColorProviderFeature = class extends client_1.TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.DocumentColorRequest.type);
    }
    fillClientCapabilities(capabilites) {
      ensure(ensure(capabilites, "textDocument"), "colorProvider").dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      let [id, options] = this.getRegistration(documentSelector, capabilities.colorProvider);
      if (!id || !options) {
        return;
      }
      this.register(this.messages, {id, registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideColorPresentations: (color, context, token) => {
          const client2 = this._client;
          const provideColorPresentations = (color2, context2, token2) => {
            const requestParams = {
              color: color2,
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(context2.document),
              range: client2.code2ProtocolConverter.asRange(context2.range)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.ColorPresentationRequest.type, requestParams, token2).then(this.asColorPresentations.bind(this), (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.ColorPresentationRequest.type, error);
              return Promise.resolve(null);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideColorPresentations ? middleware.provideColorPresentations(color, context, token, provideColorPresentations) : provideColorPresentations(color, context, token);
        },
        provideDocumentColors: (document, token) => {
          const client2 = this._client;
          const provideDocumentColors = (document2, token2) => {
            const requestParams = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.DocumentColorRequest.type, requestParams, token2).then(this.asColorInformations.bind(this), (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.ColorPresentationRequest.type, error);
              return Promise.resolve(null);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideDocumentColors ? middleware.provideDocumentColors(document, token, provideDocumentColors) : provideDocumentColors(document, token);
        }
      };
      return [vscode_1.languages.registerColorProvider(options.documentSelector, provider), provider];
    }
    asColor(color) {
      return new vscode_1.Color(color.red, color.green, color.blue, color.alpha);
    }
    asColorInformations(colorInformation) {
      if (Array.isArray(colorInformation)) {
        return colorInformation.map((ci) => {
          return new vscode_1.ColorInformation(this._client.protocol2CodeConverter.asRange(ci.range), this.asColor(ci.color));
        });
      }
      return [];
    }
    asColorPresentations(colorPresentations) {
      if (Array.isArray(colorPresentations)) {
        return colorPresentations.map((cp) => {
          let presentation = new vscode_1.ColorPresentation(cp.label);
          presentation.additionalTextEdits = this._client.protocol2CodeConverter.asTextEdits(cp.additionalTextEdits);
          presentation.textEdit = this._client.protocol2CodeConverter.asTextEdit(cp.textEdit);
          return presentation;
        });
      }
      return [];
    }
  };
  exports2.ColorProviderFeature = ColorProviderFeature;
});

// node_modules/vscode-languageclient/lib/configuration.js
var require_configuration = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var ConfigurationFeature = class {
    constructor(_client) {
      this._client = _client;
    }
    fillClientCapabilities(capabilities) {
      capabilities.workspace = capabilities.workspace || {};
      capabilities.workspace.configuration = true;
    }
    initialize() {
      let client2 = this._client;
      client2.onRequest(vscode_languageserver_protocol_1.ConfigurationRequest.type, (params, token) => {
        let configuration = (params2) => {
          let result = [];
          for (let item of params2.items) {
            let resource = item.scopeUri !== void 0 && item.scopeUri !== null ? this._client.protocol2CodeConverter.asUri(item.scopeUri) : void 0;
            result.push(this.getConfiguration(resource, item.section !== null ? item.section : void 0));
          }
          return result;
        };
        let middleware = client2.clientOptions.middleware.workspace;
        return middleware && middleware.configuration ? middleware.configuration(params, token, configuration) : configuration(params, token);
      });
    }
    getConfiguration(resource, section) {
      let result = null;
      if (section) {
        let index = section.lastIndexOf(".");
        if (index === -1) {
          result = vscode_1.workspace.getConfiguration(void 0, resource).get(section);
        } else {
          let config = vscode_1.workspace.getConfiguration(section.substr(0, index), resource);
          if (config) {
            result = config.get(section.substr(index + 1));
          }
        }
      } else {
        let config = vscode_1.workspace.getConfiguration(void 0, resource);
        result = {};
        for (let key of Object.keys(config)) {
          if (config.has(key)) {
            result[key] = config.get(key);
          }
        }
      }
      if (!result) {
        return null;
      }
      return result;
    }
  };
  exports2.ConfigurationFeature = ConfigurationFeature;
});

// node_modules/vscode-languageclient/lib/implementation.js
var require_implementation = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var client_1 = require_client();
  function ensure(target, key) {
    if (target[key] === void 0) {
      target[key] = {};
    }
    return target[key];
  }
  var ImplementationFeature = class extends client_1.TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.ImplementationRequest.type);
    }
    fillClientCapabilities(capabilites) {
      let implementationSupport = ensure(ensure(capabilites, "textDocument"), "implementation");
      implementationSupport.dynamicRegistration = true;
      implementationSupport.linkSupport = true;
    }
    initialize(capabilities, documentSelector) {
      let [id, options] = this.getRegistration(documentSelector, capabilities.implementationProvider);
      if (!id || !options) {
        return;
      }
      this.register(this.messages, {id, registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideImplementation: (document, position, token) => {
          const client2 = this._client;
          const provideImplementation = (document2, position2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.ImplementationRequest.type, client2.code2ProtocolConverter.asTextDocumentPositionParams(document2, position2), token2).then(client2.protocol2CodeConverter.asDefinitionResult, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.ImplementationRequest.type, error);
              return Promise.resolve(null);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideImplementation ? middleware.provideImplementation(document, position, token, provideImplementation) : provideImplementation(document, position, token);
        }
      };
      return [vscode_1.languages.registerImplementationProvider(options.documentSelector, provider), provider];
    }
  };
  exports2.ImplementationFeature = ImplementationFeature;
});

// node_modules/vscode-languageclient/lib/typeDefinition.js
var require_typeDefinition = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var client_1 = require_client();
  function ensure(target, key) {
    if (target[key] === void 0) {
      target[key] = {};
    }
    return target[key];
  }
  var TypeDefinitionFeature = class extends client_1.TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.TypeDefinitionRequest.type);
    }
    fillClientCapabilities(capabilites) {
      ensure(ensure(capabilites, "textDocument"), "typeDefinition").dynamicRegistration = true;
      let typeDefinitionSupport = ensure(ensure(capabilites, "textDocument"), "typeDefinition");
      typeDefinitionSupport.dynamicRegistration = true;
      typeDefinitionSupport.linkSupport = true;
    }
    initialize(capabilities, documentSelector) {
      let [id, options] = this.getRegistration(documentSelector, capabilities.typeDefinitionProvider);
      if (!id || !options) {
        return;
      }
      this.register(this.messages, {id, registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideTypeDefinition: (document, position, token) => {
          const client2 = this._client;
          const provideTypeDefinition = (document2, position2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.TypeDefinitionRequest.type, client2.code2ProtocolConverter.asTextDocumentPositionParams(document2, position2), token2).then(client2.protocol2CodeConverter.asDefinitionResult, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.TypeDefinitionRequest.type, error);
              return Promise.resolve(null);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideTypeDefinition ? middleware.provideTypeDefinition(document, position, token, provideTypeDefinition) : provideTypeDefinition(document, position, token);
        }
      };
      return [vscode_1.languages.registerTypeDefinitionProvider(options.documentSelector, provider), provider];
    }
  };
  exports2.TypeDefinitionFeature = TypeDefinitionFeature;
});

// node_modules/vscode-languageclient/lib/workspaceFolders.js
var require_workspaceFolders = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var UUID = require_uuid();
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  function access(target, key) {
    if (target === void 0) {
      return void 0;
    }
    return target[key];
  }
  function arrayDiff(left, right) {
    return left.filter((element) => right.indexOf(element) < 0);
  }
  exports2.arrayDiff = arrayDiff;
  var WorkspaceFoldersFeature = class {
    constructor(_client) {
      this._client = _client;
      this._listeners = new Map();
    }
    get messages() {
      return vscode_languageserver_protocol_1.DidChangeWorkspaceFoldersNotification.type;
    }
    fillInitializeParams(params) {
      let folders = vscode_1.workspace.workspaceFolders;
      this.initializeWithFolders(folders);
      if (folders === void 0) {
        params.workspaceFolders = null;
      } else {
        params.workspaceFolders = folders.map((folder) => this.asProtocol(folder));
      }
    }
    initializeWithFolders(currentWorkspaceFolders) {
      this._initialFolders = currentWorkspaceFolders;
    }
    fillClientCapabilities(capabilities) {
      capabilities.workspace = capabilities.workspace || {};
      capabilities.workspace.workspaceFolders = true;
    }
    initialize(capabilities) {
      let client2 = this._client;
      client2.onRequest(vscode_languageserver_protocol_1.WorkspaceFoldersRequest.type, (token) => {
        let workspaceFolders = () => {
          let folders = vscode_1.workspace.workspaceFolders;
          if (folders === void 0) {
            return null;
          }
          let result = folders.map((folder) => {
            return this.asProtocol(folder);
          });
          return result;
        };
        let middleware = client2.clientOptions.middleware.workspace;
        return middleware && middleware.workspaceFolders ? middleware.workspaceFolders(token, workspaceFolders) : workspaceFolders(token);
      });
      let value = access(access(access(capabilities, "workspace"), "workspaceFolders"), "changeNotifications");
      let id;
      if (typeof value === "string") {
        id = value;
      } else if (value === true) {
        id = UUID.generateUuid();
      }
      if (id) {
        this.register(this.messages, {
          id,
          registerOptions: void 0
        });
      }
    }
    sendInitialEvent(currentWorkspaceFolders) {
      if (this._initialFolders && currentWorkspaceFolders) {
        const removed = arrayDiff(this._initialFolders, currentWorkspaceFolders);
        const added = arrayDiff(currentWorkspaceFolders, this._initialFolders);
        if (added.length > 0 || removed.length > 0) {
          this.doSendEvent(added, removed);
        }
      } else if (this._initialFolders) {
        this.doSendEvent([], this._initialFolders);
      } else if (currentWorkspaceFolders) {
        this.doSendEvent(currentWorkspaceFolders, []);
      }
    }
    doSendEvent(addedFolders, removedFolders) {
      let params = {
        event: {
          added: addedFolders.map((folder) => this.asProtocol(folder)),
          removed: removedFolders.map((folder) => this.asProtocol(folder))
        }
      };
      this._client.sendNotification(vscode_languageserver_protocol_1.DidChangeWorkspaceFoldersNotification.type, params);
    }
    register(_message, data) {
      let id = data.id;
      let client2 = this._client;
      let disposable = vscode_1.workspace.onDidChangeWorkspaceFolders((event) => {
        let didChangeWorkspaceFolders = (event2) => {
          this.doSendEvent(event2.added, event2.removed);
        };
        let middleware = client2.clientOptions.middleware.workspace;
        middleware && middleware.didChangeWorkspaceFolders ? middleware.didChangeWorkspaceFolders(event, didChangeWorkspaceFolders) : didChangeWorkspaceFolders(event);
      });
      this._listeners.set(id, disposable);
      this.sendInitialEvent(vscode_1.workspace.workspaceFolders);
    }
    unregister(id) {
      let disposable = this._listeners.get(id);
      if (disposable === void 0) {
        return;
      }
      this._listeners.delete(id);
      disposable.dispose();
    }
    dispose() {
      for (let disposable of this._listeners.values()) {
        disposable.dispose();
      }
      this._listeners.clear();
    }
    asProtocol(workspaceFolder) {
      if (workspaceFolder === void 0) {
        return null;
      }
      return {uri: this._client.code2ProtocolConverter.asUri(workspaceFolder.uri), name: workspaceFolder.name};
    }
  };
  exports2.WorkspaceFoldersFeature = WorkspaceFoldersFeature;
});

// node_modules/vscode-languageclient/lib/foldingRange.js
var require_foldingRange = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var client_1 = require_client();
  function ensure(target, key) {
    if (target[key] === void 0) {
      target[key] = {};
    }
    return target[key];
  }
  var FoldingRangeFeature = class extends client_1.TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.FoldingRangeRequest.type);
    }
    fillClientCapabilities(capabilites) {
      let capability = ensure(ensure(capabilites, "textDocument"), "foldingRange");
      capability.dynamicRegistration = true;
      capability.rangeLimit = 5e3;
      capability.lineFoldingOnly = true;
    }
    initialize(capabilities, documentSelector) {
      let [id, options] = this.getRegistration(documentSelector, capabilities.foldingRangeProvider);
      if (!id || !options) {
        return;
      }
      this.register(this.messages, {id, registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideFoldingRanges: (document, context, token) => {
          const client2 = this._client;
          const provideFoldingRanges = (document2, _, token2) => {
            const requestParams = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.FoldingRangeRequest.type, requestParams, token2).then(this.asFoldingRanges.bind(this), (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.FoldingRangeRequest.type, error);
              return Promise.resolve(null);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideFoldingRanges ? middleware.provideFoldingRanges(document, context, token, provideFoldingRanges) : provideFoldingRanges(document, context, token);
        }
      };
      return [vscode_1.languages.registerFoldingRangeProvider(options.documentSelector, provider), provider];
    }
    asFoldingRangeKind(kind) {
      if (kind) {
        switch (kind) {
          case vscode_languageserver_protocol_1.FoldingRangeKind.Comment:
            return vscode_1.FoldingRangeKind.Comment;
          case vscode_languageserver_protocol_1.FoldingRangeKind.Imports:
            return vscode_1.FoldingRangeKind.Imports;
          case vscode_languageserver_protocol_1.FoldingRangeKind.Region:
            return vscode_1.FoldingRangeKind.Region;
        }
      }
      return void 0;
    }
    asFoldingRanges(foldingRanges) {
      if (Array.isArray(foldingRanges)) {
        return foldingRanges.map((r) => {
          return new vscode_1.FoldingRange(r.startLine, r.endLine, this.asFoldingRangeKind(r.kind));
        });
      }
      return [];
    }
  };
  exports2.FoldingRangeFeature = FoldingRangeFeature;
});

// node_modules/vscode-languageclient/lib/declaration.js
var require_declaration = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var client_1 = require_client();
  function ensure(target, key) {
    if (target[key] === void 0) {
      target[key] = {};
    }
    return target[key];
  }
  var DeclarationFeature = class extends client_1.TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.DeclarationRequest.type);
    }
    fillClientCapabilities(capabilites) {
      const declarationSupport = ensure(ensure(capabilites, "textDocument"), "declaration");
      declarationSupport.dynamicRegistration = true;
      declarationSupport.linkSupport = true;
    }
    initialize(capabilities, documentSelector) {
      const [id, options] = this.getRegistration(documentSelector, capabilities.declarationProvider);
      if (!id || !options) {
        return;
      }
      this.register(this.messages, {id, registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideDeclaration: (document, position, token) => {
          const client2 = this._client;
          const provideDeclaration = (document2, position2, token2) => {
            return client2.sendRequest(vscode_languageserver_protocol_1.DeclarationRequest.type, client2.code2ProtocolConverter.asTextDocumentPositionParams(document2, position2), token2).then(client2.protocol2CodeConverter.asDeclarationResult, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.DeclarationRequest.type, error);
              return Promise.resolve(null);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideDeclaration ? middleware.provideDeclaration(document, position, token, provideDeclaration) : provideDeclaration(document, position, token);
        }
      };
      return [vscode_1.languages.registerDeclarationProvider(options.documentSelector, provider), provider];
    }
  };
  exports2.DeclarationFeature = DeclarationFeature;
});

// node_modules/vscode-languageclient/lib/selectionRange.js
var require_selectionRange = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var client_1 = require_client();
  function ensure(target, key) {
    if (target[key] === void 0) {
      target[key] = Object.create(null);
    }
    return target[key];
  }
  var SelectionRangeFeature = class extends client_1.TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.SelectionRangeRequest.type);
    }
    fillClientCapabilities(capabilites) {
      let capability = ensure(ensure(capabilites, "textDocument"), "selectionRange");
      capability.dynamicRegistration = true;
    }
    initialize(capabilities, documentSelector) {
      let [id, options] = this.getRegistration(documentSelector, capabilities.selectionRangeProvider);
      if (!id || !options) {
        return;
      }
      this.register(this.messages, {id, registerOptions: options});
    }
    registerLanguageProvider(options) {
      const provider = {
        provideSelectionRanges: (document, positions, token) => {
          const client2 = this._client;
          const provideSelectionRanges = (document2, positions2, token2) => {
            const requestParams = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2),
              positions: client2.code2ProtocolConverter.asPositions(positions2)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.SelectionRangeRequest.type, requestParams, token2).then((ranges) => client2.protocol2CodeConverter.asSelectionRanges(ranges), (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.SelectionRangeRequest.type, error);
              return Promise.resolve(null);
            });
          };
          const middleware = client2.clientOptions.middleware;
          return middleware.provideSelectionRanges ? middleware.provideSelectionRanges(document, positions, token, provideSelectionRanges) : provideSelectionRanges(document, positions, token);
        }
      };
      return [vscode_1.languages.registerSelectionRangeProvider(options.documentSelector, provider), provider];
    }
  };
  exports2.SelectionRangeFeature = SelectionRangeFeature;
});

// node_modules/vscode-languageclient/lib/progress.js
var require_progress = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_languageserver_protocol_1 = require_main3();
  var progressPart_1 = require_progressPart();
  function ensure(target, key) {
    if (target[key] === void 0) {
      target[key] = Object.create(null);
    }
    return target[key];
  }
  var ProgressFeature = class {
    constructor(_client) {
      this._client = _client;
    }
    fillClientCapabilities(capabilities) {
      ensure(capabilities, "window").workDoneProgress = true;
    }
    initialize() {
      let client2 = this._client;
      let createHandler = (params) => {
        new progressPart_1.ProgressPart(this._client, params.token);
      };
      client2.onRequest(vscode_languageserver_protocol_1.WorkDoneProgressCreateRequest.type, createHandler);
    }
  };
  exports2.ProgressFeature = ProgressFeature;
});

// node_modules/vscode-languageclient/lib/callHierarchy.proposed.js
var require_callHierarchy_proposed = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var client_1 = require_client();
  function ensure(target, key) {
    if (target[key] === void 0) {
      target[key] = {};
    }
    return target[key];
  }
  var protocol2code;
  (function(protocol2code2) {
    function asCallHierarchyItem(converter, item) {
      if (item === null) {
        return void 0;
      }
      let result = new vscode_1.CallHierarchyItem(converter.asSymbolKind(item.kind), item.name, item.detail || "", converter.asUri(item.uri), converter.asRange(item.range), converter.asRange(item.selectionRange));
      if (item.tags !== void 0) {
        result.tags = converter.asSymbolTags(item.tags);
      }
      return result;
    }
    protocol2code2.asCallHierarchyItem = asCallHierarchyItem;
    function asCallHierarchyItems(converter, items) {
      if (items === null) {
        return void 0;
      }
      let result = items.map((item) => asCallHierarchyItem(converter, item));
      return result[0];
    }
    protocol2code2.asCallHierarchyItems = asCallHierarchyItems;
    function asCallHierarchyIncomingCall(converter, item) {
      return new vscode_1.CallHierarchyIncomingCall(asCallHierarchyItem(converter, item.from), converter.asRanges(item.fromRanges));
    }
    protocol2code2.asCallHierarchyIncomingCall = asCallHierarchyIncomingCall;
    function asCallHierarchyIncomingCalls(converter, items) {
      if (items === null) {
        return void 0;
      }
      return items.map((item) => asCallHierarchyIncomingCall(converter, item));
    }
    protocol2code2.asCallHierarchyIncomingCalls = asCallHierarchyIncomingCalls;
    function asCallHierarchyOutgoingCall(converter, item) {
      return new vscode_1.CallHierarchyOutgoingCall(asCallHierarchyItem(converter, item.to), converter.asRanges(item.fromRanges));
    }
    protocol2code2.asCallHierarchyOutgoingCall = asCallHierarchyOutgoingCall;
    function asCallHierarchyOutgoingCalls(converter, items) {
      if (items === null) {
        return void 0;
      }
      return items.map((item) => asCallHierarchyOutgoingCall(converter, item));
    }
    protocol2code2.asCallHierarchyOutgoingCalls = asCallHierarchyOutgoingCalls;
  })(protocol2code || (protocol2code = {}));
  var code2protocol;
  (function(code2protocol2) {
    function asCallHierarchyItem(converter, value) {
      const result = {
        name: value.name,
        kind: converter.asSymbolKind(value.kind),
        uri: converter.asUri(value.uri),
        range: converter.asRange(value.range),
        selectionRange: converter.asRange(value.selectionRange)
      };
      if (value.detail !== void 0 && value.detail.length > 0) {
        result.detail = value.detail;
      }
      if (value.tags !== void 0) {
        result.tags = converter.asSymbolTags(value.tags);
      }
      return result;
    }
    code2protocol2.asCallHierarchyItem = asCallHierarchyItem;
  })(code2protocol || (code2protocol = {}));
  var CallHierarchyProvider = class {
    constructor(client2) {
      this.client = client2;
      this.middleware = client2.clientOptions.middleware;
    }
    prepareCallHierarchy(document, position, token) {
      const client2 = this.client;
      const middleware = this.middleware;
      const prepareCallHierarchy = (document2, position2, token2) => {
        const params = client2.code2ProtocolConverter.asTextDocumentPositionParams(document2, position2);
        return client2.sendRequest(vscode_languageserver_protocol_1.Proposed.CallHierarchyPrepareRequest.type, params, token2).then((result) => {
          return protocol2code.asCallHierarchyItems(this.client.protocol2CodeConverter, result);
        }, (error) => {
          client2.logFailedRequest(vscode_languageserver_protocol_1.Proposed.CallHierarchyPrepareRequest.type, error);
          return Promise.resolve(null);
        });
      };
      return middleware.prepareCallHierarchy ? middleware.prepareCallHierarchy(document, position, token, prepareCallHierarchy) : prepareCallHierarchy(document, position, token);
    }
    provideCallHierarchyIncomingCalls(item, token) {
      const client2 = this.client;
      const middleware = this.middleware;
      const provideCallHierarchyIncomingCalls = (item2, token2) => {
        const params = {
          item: code2protocol.asCallHierarchyItem(client2.code2ProtocolConverter, item2)
        };
        return client2.sendRequest(vscode_languageserver_protocol_1.Proposed.CallHierarchyIncomingCallsRequest.type, params, token2).then((result) => {
          return protocol2code.asCallHierarchyIncomingCalls(client2.protocol2CodeConverter, result);
        }, (error) => {
          client2.logFailedRequest(vscode_languageserver_protocol_1.Proposed.CallHierarchyIncomingCallsRequest.type, error);
          return Promise.resolve(null);
        });
      };
      return middleware.provideCallHierarchyIncomingCalls ? middleware.provideCallHierarchyIncomingCalls(item, token, provideCallHierarchyIncomingCalls) : provideCallHierarchyIncomingCalls(item, token);
    }
    provideCallHierarchyOutgoingCalls(item, token) {
      const client2 = this.client;
      const middleware = this.middleware;
      const provideCallHierarchyOutgoingCalls = (item2, token2) => {
        const params = {
          item: code2protocol.asCallHierarchyItem(client2.code2ProtocolConverter, item2)
        };
        return client2.sendRequest(vscode_languageserver_protocol_1.Proposed.CallHierarchyOutgoingCallsRequest.type, params, token2).then((result) => {
          return protocol2code.asCallHierarchyOutgoingCalls(client2.protocol2CodeConverter, result);
        }, (error) => {
          client2.logFailedRequest(vscode_languageserver_protocol_1.Proposed.CallHierarchyOutgoingCallsRequest.type, error);
          return Promise.resolve(null);
        });
      };
      return middleware.provideCallHierarchyOutgingCalls ? middleware.provideCallHierarchyOutgingCalls(item, token, provideCallHierarchyOutgoingCalls) : provideCallHierarchyOutgoingCalls(item, token);
    }
  };
  var CallHierarchyFeature = class extends client_1.TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.Proposed.CallHierarchyPrepareRequest.type);
    }
    fillClientCapabilities(cap) {
      const capabilites = cap;
      const capability = ensure(ensure(capabilites, "textDocument"), "callHierarchy");
      capability.dynamicRegistration = true;
    }
    initialize(cap, documentSelector) {
      const capabilities = cap;
      const [id, options] = this.getRegistration(documentSelector, capabilities.callHierarchyProvider);
      if (!id || !options) {
        return;
      }
      this.register(this.messages, {id, registerOptions: options});
    }
    registerLanguageProvider(options) {
      const client2 = this._client;
      const provider = new CallHierarchyProvider(client2);
      return [vscode_1.languages.registerCallHierarchyProvider(options.documentSelector, provider), provider];
    }
  };
  exports2.CallHierarchyFeature = CallHierarchyFeature;
});

// node_modules/vscode-languageclient/lib/semanticTokens.proposed.js
var require_semanticTokens_proposed = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var vscode6 = require("vscode");
  var client_1 = require_client();
  var vscode_languageserver_protocol_1 = require_main3();
  function ensure(target, key) {
    if (target[key] === void 0) {
      target[key] = {};
    }
    return target[key];
  }
  var protocol2code;
  (function(protocol2code2) {
    function asSemanticTokens(value) {
      if (value === void 0 || value === null) {
        return void 0;
      }
      return new vscode6.SemanticTokens(new Uint32Array(value.data), value.resultId);
    }
    protocol2code2.asSemanticTokens = asSemanticTokens;
    function asSemanticTokensEdit(value) {
      return new vscode6.SemanticTokensEdit(value.start, value.deleteCount, value.data !== void 0 ? new Uint32Array(value.data) : void 0);
    }
    protocol2code2.asSemanticTokensEdit = asSemanticTokensEdit;
    function asSemanticTokensEdits(value) {
      if (value === void 0 || value === null) {
        return void 0;
      }
      return new vscode6.SemanticTokensEdits(value.edits.map(asSemanticTokensEdit), value.resultId);
    }
    protocol2code2.asSemanticTokensEdits = asSemanticTokensEdits;
    function asLegend(value) {
      return value;
    }
    protocol2code2.asLegend = asLegend;
  })(protocol2code || (protocol2code = {}));
  var SemanticTokensFeature = class extends client_1.TextDocumentFeature {
    constructor(client2) {
      super(client2, vscode_languageserver_protocol_1.Proposed.SemanticTokensRequest.type);
    }
    fillClientCapabilities(cap) {
      const capabilites = cap;
      let capability = ensure(ensure(capabilites, "textDocument"), "semanticTokens");
      capability.dynamicRegistration = true;
      capability.tokenTypes = [
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.comment,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.keyword,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.number,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.regexp,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.operator,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.namespace,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.type,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.struct,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.class,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.interface,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.enum,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.typeParameter,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.function,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.member,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.macro,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.variable,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.parameter,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.property,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenTypes.label
      ];
      capability.tokenModifiers = [
        vscode_languageserver_protocol_1.Proposed.SemanticTokenModifiers.declaration,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenModifiers.documentation,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenModifiers.static,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenModifiers.abstract,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenModifiers.deprecated,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenModifiers.async,
        vscode_languageserver_protocol_1.Proposed.SemanticTokenModifiers.readonly
      ];
    }
    initialize(cap, documentSelector) {
      const capabilities = cap;
      let [id, options] = this.getRegistration(documentSelector, capabilities.semanticTokensProvider);
      if (!id || !options) {
        return;
      }
      this.register(this.messages, {id, registerOptions: options});
    }
    registerLanguageProvider(options) {
      const hasEditProvider = options.documentProvider !== void 0 && typeof options.documentProvider !== "boolean" && options.documentProvider.edits === true;
      const documentProvider = {
        provideDocumentSemanticTokens: (document, token) => {
          const client2 = this._client;
          const middleware = client2.clientOptions.middleware;
          const provideDocumentSemanticTokens = (document2, token2) => {
            const params = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.Proposed.SemanticTokensRequest.type, params, token2).then((result) => {
              return protocol2code.asSemanticTokens(result);
            }, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.Proposed.SemanticTokensRequest.type, error);
              return void 0;
            });
          };
          return middleware.provideDocumentSemanticTokens ? middleware.provideDocumentSemanticTokens(document, token, provideDocumentSemanticTokens) : provideDocumentSemanticTokens(document, token);
        },
        provideDocumentSemanticTokensEdits: hasEditProvider ? (document, previousResultId, token) => {
          const client2 = this._client;
          const middleware = client2.clientOptions.middleware;
          const provideDocumentSemanticTokensEdits = (document2, previousResultId2, token2) => {
            const params = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2),
              previousResultId: previousResultId2
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.Proposed.SemanticTokensEditsRequest.type, params, token2).then((result) => {
              if (vscode_languageserver_protocol_1.Proposed.SemanticTokens.is(result)) {
                return protocol2code.asSemanticTokens(result);
              } else {
                return protocol2code.asSemanticTokensEdits(result);
              }
            }, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.Proposed.SemanticTokensEditsRequest.type, error);
              return void 0;
            });
          };
          return middleware.provideDocumentSemanticTokensEdits ? middleware.provideDocumentSemanticTokensEdits(document, previousResultId, token, provideDocumentSemanticTokensEdits) : provideDocumentSemanticTokensEdits(document, previousResultId, token);
        } : void 0
      };
      const hasRangeProvider = options.rangeProvider === true;
      const rangeProvider = hasRangeProvider ? {
        provideDocumentRangeSemanticTokens: (document, range, token) => {
          const client2 = this._client;
          const middleware = client2.clientOptions.middleware;
          const provideDocumentRangeSemanticTokens = (document2, range2, token2) => {
            const params = {
              textDocument: client2.code2ProtocolConverter.asTextDocumentIdentifier(document2),
              range: client2.code2ProtocolConverter.asRange(range2)
            };
            return client2.sendRequest(vscode_languageserver_protocol_1.Proposed.SemanticTokensRangeRequest.type, params, token2).then((result) => {
              return protocol2code.asSemanticTokens(result);
            }, (error) => {
              client2.logFailedRequest(vscode_languageserver_protocol_1.Proposed.SemanticTokensRangeRequest.type, error);
              return void 0;
            });
          };
          return middleware.provideDocumentRangeSemanticTokens ? middleware.provideDocumentRangeSemanticTokens(document, range, token, provideDocumentRangeSemanticTokens) : provideDocumentRangeSemanticTokens(document, range, token);
        }
      } : void 0;
      const disposables = [];
      const legend = protocol2code.asLegend(options.legend);
      disposables.push(vscode6.languages.registerDocumentSemanticTokensProvider(options.documentSelector, documentProvider, legend));
      if (rangeProvider !== void 0) {
        disposables.push(vscode6.languages.registerDocumentRangeSemanticTokensProvider(options.documentSelector, rangeProvider, legend));
      }
      return [new vscode6.Disposable(() => disposables.forEach((item) => item.dispose())), {document: documentProvider, range: rangeProvider}];
    }
  };
  exports2.SemanticTokensFeature = SemanticTokensFeature;
});

// node_modules/vscode-languageclient/lib/utils/processes.js
var require_processes = __commonJS((exports2) => {
  "use strict";
  Object.defineProperty(exports2, "__esModule", {value: true});
  var cp = require("child_process");
  var path_1 = require("path");
  var isWindows = process.platform === "win32";
  var isMacintosh = process.platform === "darwin";
  var isLinux = process.platform === "linux";
  function terminate(process2, cwd) {
    if (isWindows) {
      try {
        let options = {
          stdio: ["pipe", "pipe", "ignore"]
        };
        if (cwd) {
          options.cwd = cwd;
        }
        cp.execFileSync("taskkill", ["/T", "/F", "/PID", process2.pid.toString()], options);
        return true;
      } catch (err) {
        return false;
      }
    } else if (isLinux || isMacintosh) {
      try {
        var cmd = path_1.join(__dirname, "terminateProcess.sh");
        var result = cp.spawnSync(cmd, [process2.pid.toString()]);
        return result.error ? false : true;
      } catch (err) {
        return false;
      }
    } else {
      process2.kill("SIGKILL");
      return true;
    }
  }
  exports2.terminate = terminate;
});

// node_modules/vscode-languageclient/lib/main.js
var require_main4 = __commonJS((exports2) => {
  "use strict";
  function __export2(m) {
    for (var p in m)
      if (!exports2.hasOwnProperty(p))
        exports2[p] = m[p];
  }
  Object.defineProperty(exports2, "__esModule", {value: true});
  var cp = require("child_process");
  var fs = require("fs");
  var SemVer = require_semver();
  var client_1 = require_client();
  var vscode_1 = require("vscode");
  var vscode_languageserver_protocol_1 = require_main3();
  var colorProvider_1 = require_colorProvider();
  var configuration_1 = require_configuration();
  var implementation_1 = require_implementation();
  var typeDefinition_1 = require_typeDefinition();
  var workspaceFolders_1 = require_workspaceFolders();
  var foldingRange_1 = require_foldingRange();
  var declaration_1 = require_declaration();
  var selectionRange_1 = require_selectionRange();
  var progress_1 = require_progress();
  var callHierarchy_proposed_1 = require_callHierarchy_proposed();
  var semanticTokens_proposed_1 = require_semanticTokens_proposed();
  var Is = require_is3();
  var processes_1 = require_processes();
  __export2(require_client());
  var REQUIRED_VSCODE_VERSION = "^1.41.0";
  var Executable;
  (function(Executable2) {
    function is(value) {
      return Is.string(value.command);
    }
    Executable2.is = is;
  })(Executable || (Executable = {}));
  var TransportKind;
  (function(TransportKind2) {
    TransportKind2[TransportKind2["stdio"] = 0] = "stdio";
    TransportKind2[TransportKind2["ipc"] = 1] = "ipc";
    TransportKind2[TransportKind2["pipe"] = 2] = "pipe";
    TransportKind2[TransportKind2["socket"] = 3] = "socket";
  })(TransportKind = exports2.TransportKind || (exports2.TransportKind = {}));
  var Transport;
  (function(Transport2) {
    function isSocket(value) {
      let candidate = value;
      return candidate && candidate.kind === TransportKind.socket && Is.number(candidate.port);
    }
    Transport2.isSocket = isSocket;
  })(Transport || (Transport = {}));
  var NodeModule;
  (function(NodeModule2) {
    function is(value) {
      return Is.string(value.module);
    }
    NodeModule2.is = is;
  })(NodeModule || (NodeModule = {}));
  var StreamInfo;
  (function(StreamInfo2) {
    function is(value) {
      let candidate = value;
      return candidate && candidate.writer !== void 0 && candidate.reader !== void 0;
    }
    StreamInfo2.is = is;
  })(StreamInfo || (StreamInfo = {}));
  var ChildProcessInfo;
  (function(ChildProcessInfo2) {
    function is(value) {
      let candidate = value;
      return candidate && candidate.process !== void 0 && typeof candidate.detached === "boolean";
    }
    ChildProcessInfo2.is = is;
  })(ChildProcessInfo || (ChildProcessInfo = {}));
  var LanguageClient2 = class extends client_1.BaseLanguageClient {
    constructor(arg1, arg2, arg3, arg4, arg5) {
      let id;
      let name;
      let serverOptions;
      let clientOptions;
      let forceDebug;
      if (Is.string(arg2)) {
        id = arg1;
        name = arg2;
        serverOptions = arg3;
        clientOptions = arg4;
        forceDebug = !!arg5;
      } else {
        id = arg1.toLowerCase();
        name = arg1;
        serverOptions = arg2;
        clientOptions = arg3;
        forceDebug = arg4;
      }
      if (forceDebug === void 0) {
        forceDebug = false;
      }
      super(id, name, clientOptions);
      this._serverOptions = serverOptions;
      this._forceDebug = forceDebug;
      try {
        this.checkVersion();
      } catch (error) {
        if (Is.string(error.message)) {
          this.outputChannel.appendLine(error.message);
        }
        throw error;
      }
    }
    checkVersion() {
      let codeVersion = SemVer.parse(vscode_1.version);
      if (!codeVersion) {
        throw new Error(`No valid VS Code version detected. Version string is: ${vscode_1.version}`);
      }
      if (codeVersion.prerelease && codeVersion.prerelease.length > 0) {
        codeVersion.prerelease = [];
      }
      if (!SemVer.satisfies(codeVersion, REQUIRED_VSCODE_VERSION)) {
        throw new Error(`The language client requires VS Code version ${REQUIRED_VSCODE_VERSION} but received version ${vscode_1.version}`);
      }
    }
    stop() {
      return super.stop().then(() => {
        if (this._serverProcess) {
          let toCheck = this._serverProcess;
          this._serverProcess = void 0;
          if (this._isDetached === void 0 || !this._isDetached) {
            this.checkProcessDied(toCheck);
          }
          this._isDetached = void 0;
        }
      });
    }
    checkProcessDied(childProcess) {
      if (!childProcess) {
        return;
      }
      setTimeout(() => {
        try {
          process.kill(childProcess.pid, 0);
          processes_1.terminate(childProcess);
        } catch (error) {
        }
      }, 2e3);
    }
    handleConnectionClosed() {
      this._serverProcess = void 0;
      super.handleConnectionClosed();
    }
    createMessageTransports(encoding) {
      function getEnvironment(env, fork) {
        if (!env && !fork) {
          return void 0;
        }
        let result = Object.create(null);
        Object.keys(process.env).forEach((key) => result[key] = process.env[key]);
        if (fork) {
          result["ELECTRON_RUN_AS_NODE"] = "1";
          result["ELECTRON_NO_ASAR"] = "1";
        }
        if (env) {
          Object.keys(env).forEach((key) => result[key] = env[key]);
        }
        return result;
      }
      const debugStartWith = ["--debug=", "--debug-brk=", "--inspect=", "--inspect-brk="];
      const debugEquals = ["--debug", "--debug-brk", "--inspect", "--inspect-brk"];
      function startedInDebugMode() {
        let args = process.execArgv;
        if (args) {
          return args.some((arg) => {
            return debugStartWith.some((value) => arg.startsWith(value)) || debugEquals.some((value) => arg === value);
          });
        }
        return false;
      }
      function assertStdio(process2) {
        if (process2.stdin === null || process2.stdout === null || process2.stderr === null) {
          throw new Error("Process created without stdio streams");
        }
      }
      let server = this._serverOptions;
      if (Is.func(server)) {
        return server().then((result) => {
          if (client_1.MessageTransports.is(result)) {
            this._isDetached = !!result.detached;
            return result;
          } else if (StreamInfo.is(result)) {
            this._isDetached = !!result.detached;
            return {reader: new vscode_languageserver_protocol_1.StreamMessageReader(result.reader), writer: new vscode_languageserver_protocol_1.StreamMessageWriter(result.writer)};
          } else {
            let cp2;
            if (ChildProcessInfo.is(result)) {
              cp2 = result.process;
              this._isDetached = result.detached;
            } else {
              cp2 = result;
              this._isDetached = false;
            }
            cp2.stderr.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
            return {reader: new vscode_languageserver_protocol_1.StreamMessageReader(cp2.stdout), writer: new vscode_languageserver_protocol_1.StreamMessageWriter(cp2.stdin)};
          }
        });
      }
      let json;
      let runDebug = server;
      if (runDebug.run || runDebug.debug) {
        if (this._forceDebug || startedInDebugMode()) {
          json = runDebug.debug;
        } else {
          json = runDebug.run;
        }
      } else {
        json = server;
      }
      return this._getServerWorkingDir(json.options).then((serverWorkingDir) => {
        if (NodeModule.is(json) && json.module) {
          let node = json;
          let transport = node.transport || TransportKind.stdio;
          if (node.runtime) {
            let args = [];
            let options = node.options || Object.create(null);
            if (options.execArgv) {
              options.execArgv.forEach((element) => args.push(element));
            }
            args.push(node.module);
            if (node.args) {
              node.args.forEach((element) => args.push(element));
            }
            let execOptions = Object.create(null);
            execOptions.cwd = serverWorkingDir;
            execOptions.env = getEnvironment(options.env, false);
            let pipeName = void 0;
            if (transport === TransportKind.ipc) {
              execOptions.stdio = [null, null, null, "ipc"];
              args.push("--node-ipc");
            } else if (transport === TransportKind.stdio) {
              args.push("--stdio");
            } else if (transport === TransportKind.pipe) {
              pipeName = vscode_languageserver_protocol_1.generateRandomPipeName();
              args.push(`--pipe=${pipeName}`);
            } else if (Transport.isSocket(transport)) {
              args.push(`--socket=${transport.port}`);
            }
            args.push(`--clientProcessId=${process.pid.toString()}`);
            if (transport === TransportKind.ipc || transport === TransportKind.stdio) {
              let serverProcess = cp.spawn(node.runtime, args, execOptions);
              if (!serverProcess || !serverProcess.pid) {
                return Promise.reject(`Launching server using runtime ${node.runtime} failed.`);
              }
              this._serverProcess = serverProcess;
              serverProcess.stderr.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
              if (transport === TransportKind.ipc) {
                serverProcess.stdout.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                return Promise.resolve({reader: new vscode_languageserver_protocol_1.IPCMessageReader(serverProcess), writer: new vscode_languageserver_protocol_1.IPCMessageWriter(serverProcess)});
              } else {
                return Promise.resolve({reader: new vscode_languageserver_protocol_1.StreamMessageReader(serverProcess.stdout), writer: new vscode_languageserver_protocol_1.StreamMessageWriter(serverProcess.stdin)});
              }
            } else if (transport === TransportKind.pipe) {
              return vscode_languageserver_protocol_1.createClientPipeTransport(pipeName).then((transport2) => {
                let process2 = cp.spawn(node.runtime, args, execOptions);
                if (!process2 || !process2.pid) {
                  return Promise.reject(`Launching server using runtime ${node.runtime} failed.`);
                }
                this._serverProcess = process2;
                process2.stderr.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                process2.stdout.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                return transport2.onConnected().then((protocol) => {
                  return {reader: protocol[0], writer: protocol[1]};
                });
              });
            } else if (Transport.isSocket(transport)) {
              return vscode_languageserver_protocol_1.createClientSocketTransport(transport.port).then((transport2) => {
                let process2 = cp.spawn(node.runtime, args, execOptions);
                if (!process2 || !process2.pid) {
                  return Promise.reject(`Launching server using runtime ${node.runtime} failed.`);
                }
                this._serverProcess = process2;
                process2.stderr.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                process2.stdout.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                return transport2.onConnected().then((protocol) => {
                  return {reader: protocol[0], writer: protocol[1]};
                });
              });
            }
          } else {
            let pipeName = void 0;
            return new Promise((resolve, _reject) => {
              let args = node.args && node.args.slice() || [];
              if (transport === TransportKind.ipc) {
                args.push("--node-ipc");
              } else if (transport === TransportKind.stdio) {
                args.push("--stdio");
              } else if (transport === TransportKind.pipe) {
                pipeName = vscode_languageserver_protocol_1.generateRandomPipeName();
                args.push(`--pipe=${pipeName}`);
              } else if (Transport.isSocket(transport)) {
                args.push(`--socket=${transport.port}`);
              }
              args.push(`--clientProcessId=${process.pid.toString()}`);
              let options = node.options || Object.create(null);
              options.env = getEnvironment(options.env, true);
              options.execArgv = options.execArgv || [];
              options.cwd = serverWorkingDir;
              options.silent = true;
              if (transport === TransportKind.ipc || transport === TransportKind.stdio) {
                let sp = cp.fork(node.module, args || [], options);
                assertStdio(sp);
                this._serverProcess = sp;
                sp.stderr.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                if (transport === TransportKind.ipc) {
                  sp.stdout.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                  resolve({reader: new vscode_languageserver_protocol_1.IPCMessageReader(this._serverProcess), writer: new vscode_languageserver_protocol_1.IPCMessageWriter(this._serverProcess)});
                } else {
                  resolve({reader: new vscode_languageserver_protocol_1.StreamMessageReader(sp.stdout), writer: new vscode_languageserver_protocol_1.StreamMessageWriter(sp.stdin)});
                }
              } else if (transport === TransportKind.pipe) {
                vscode_languageserver_protocol_1.createClientPipeTransport(pipeName).then((transport2) => {
                  let sp = cp.fork(node.module, args || [], options);
                  assertStdio(sp);
                  this._serverProcess = sp;
                  sp.stderr.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                  sp.stdout.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                  transport2.onConnected().then((protocol) => {
                    resolve({reader: protocol[0], writer: protocol[1]});
                  });
                });
              } else if (Transport.isSocket(transport)) {
                vscode_languageserver_protocol_1.createClientSocketTransport(transport.port).then((transport2) => {
                  let sp = cp.fork(node.module, args || [], options);
                  assertStdio(sp);
                  this._serverProcess = sp;
                  sp.stderr.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                  sp.stdout.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
                  transport2.onConnected().then((protocol) => {
                    resolve({reader: protocol[0], writer: protocol[1]});
                  });
                });
              }
            });
          }
        } else if (Executable.is(json) && json.command) {
          let command = json;
          let args = command.args || [];
          let options = Object.assign({}, command.options);
          options.cwd = options.cwd || serverWorkingDir;
          let serverProcess = cp.spawn(command.command, args, options);
          if (!serverProcess || !serverProcess.pid) {
            return Promise.reject(`Launching server using command ${command.command} failed.`);
          }
          serverProcess.stderr.on("data", (data) => this.outputChannel.append(Is.string(data) ? data : data.toString(encoding)));
          this._serverProcess = serverProcess;
          this._isDetached = !!options.detached;
          return Promise.resolve({reader: new vscode_languageserver_protocol_1.StreamMessageReader(serverProcess.stdout), writer: new vscode_languageserver_protocol_1.StreamMessageWriter(serverProcess.stdin)});
        }
        return Promise.reject(new Error(`Unsupported server configuration ` + JSON.stringify(server, null, 4)));
      });
    }
    registerProposedFeatures() {
      this.registerFeatures(ProposedFeatures.createAll(this));
    }
    registerBuiltinFeatures() {
      super.registerBuiltinFeatures();
      this.registerFeature(new configuration_1.ConfigurationFeature(this));
      this.registerFeature(new typeDefinition_1.TypeDefinitionFeature(this));
      this.registerFeature(new implementation_1.ImplementationFeature(this));
      this.registerFeature(new colorProvider_1.ColorProviderFeature(this));
      this.registerFeature(new workspaceFolders_1.WorkspaceFoldersFeature(this));
      this.registerFeature(new foldingRange_1.FoldingRangeFeature(this));
      this.registerFeature(new declaration_1.DeclarationFeature(this));
      this.registerFeature(new selectionRange_1.SelectionRangeFeature(this));
      this.registerFeature(new progress_1.ProgressFeature(this));
    }
    _mainGetRootPath() {
      let folders = vscode_1.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        return void 0;
      }
      let folder = folders[0];
      if (folder.uri.scheme === "file") {
        return folder.uri.fsPath;
      }
      return void 0;
    }
    _getServerWorkingDir(options) {
      let cwd = options && options.cwd;
      if (!cwd) {
        cwd = this.clientOptions.workspaceFolder ? this.clientOptions.workspaceFolder.uri.fsPath : this._mainGetRootPath();
      }
      if (cwd) {
        return new Promise((s) => {
          fs.lstat(cwd, (err, stats) => {
            s(!err && stats.isDirectory() ? cwd : void 0);
          });
        });
      }
      return Promise.resolve(void 0);
    }
  };
  exports2.LanguageClient = LanguageClient2;
  var SettingMonitor = class {
    constructor(_client, _setting) {
      this._client = _client;
      this._setting = _setting;
      this._listeners = [];
    }
    start() {
      vscode_1.workspace.onDidChangeConfiguration(this.onDidChangeConfiguration, this, this._listeners);
      this.onDidChangeConfiguration();
      return new vscode_1.Disposable(() => {
        if (this._client.needsStop()) {
          this._client.stop();
        }
      });
    }
    onDidChangeConfiguration() {
      let index = this._setting.indexOf(".");
      let primary = index >= 0 ? this._setting.substr(0, index) : this._setting;
      let rest = index >= 0 ? this._setting.substr(index + 1) : void 0;
      let enabled = rest ? vscode_1.workspace.getConfiguration(primary).get(rest, false) : vscode_1.workspace.getConfiguration(primary);
      if (enabled && this._client.needsStart()) {
        this._client.start();
      } else if (!enabled && this._client.needsStop()) {
        this._client.stop();
      }
    }
  };
  exports2.SettingMonitor = SettingMonitor;
  var ProposedFeatures;
  (function(ProposedFeatures2) {
    function createAll(client2) {
      let result = [
        new callHierarchy_proposed_1.CallHierarchyFeature(client2),
        new semanticTokens_proposed_1.SemanticTokensFeature(client2)
      ];
      return result;
    }
    ProposedFeatures2.createAll = createAll;
  })(ProposedFeatures = exports2.ProposedFeatures || (exports2.ProposedFeatures = {}));
});

// src/extension.ts
__markAsModule(exports);
__export(exports, {
  activate: () => activate,
  client: () => client,
  deactivate: () => deactivate
});
var vscode5 = __toModule(require("vscode"));
var import_vscode = __toModule(require("vscode"));
var import_vscode_languageclient = __toModule(require_main4());

// src/requirements.ts
var vscode = __toModule(require("vscode"));
async function resolveRequirements() {
  const pathToVM = await checkPathToVM();
  const pathToImage = await checkPathToImage();
  return Promise.resolve({pathToVM, pathToImage});
}
async function checkPathToVM() {
  return new Promise(async (resolve, reject) => {
    if (vscode.workspace.getConfiguration("pharo").get("pathToVM") === "") {
      reject({
        message: "Path to VM not set",
        label: "Open settings",
        command: "workbench.action.openSettingsJson"
      });
    }
    return resolve(vscode.workspace.getConfiguration("pharo").get("pathToVM"));
  });
}
async function checkPathToImage() {
  return new Promise(async (resolve, reject) => {
    if (vscode.workspace.getConfiguration("pharo").get("pathToImage") === "") {
      reject({
        message: "Path to Image not set",
        label: "Open settings",
        command: "workbench.action.openSettingsJson"
      });
    }
    return resolve(vscode.workspace.getConfiguration("pharo").get("pathToImage"));
  });
}

// src/extension.ts
var net = __toModule(require("net"));
var child_process = __toModule(require("child_process"));

// src/activateDebug.ts
var vscode2 = __toModule(require("vscode"));
function activateDebug(context, factory) {
  context.subscriptions.push(vscode2.commands.registerCommand("extension.pharo-debug.debugEditorContents", (resource) => {
    let targetResource = resource;
    if (!targetResource && vscode2.window.activeTextEditor) {
      targetResource = vscode2.window.activeTextEditor.document.uri;
    }
    if (targetResource) {
      vscode2.debug.startDebugging(void 0, {
        type: "pharodb",
        name: "Debug File",
        request: "launch",
        program: targetResource.fsPath
      });
    }
  }));
  context.subscriptions.push(vscode2.debug.registerDebugAdapterDescriptorFactory("pharodb", factory));
}

// src/debugFactory.ts
var vscode3 = __toModule(require("vscode"));
var DebugAdapterFactory = class {
  async createDebugAdapterDescriptor(session, executable) {
    const port = client.sendRequest("dap:startServer", {}).then((result) => {
      return result;
    });
    return new vscode3.DebugAdapterServer(await port, "localhost");
  }
};

// src/moosebookProvider.ts
var vscode4 = __toModule(require("vscode"));

// src/moosebook.ts
var Moosebook = class {
  constructor(doc) {
  }
  async dispose() {
  }
  async restartKernel() {
  }
  async toggleDebugging(document) {
  }
  async eval(cell) {
    return client.sendRequest("command:notebookPrintIt", {line: cell.document.getText()}).then((result) => {
      if (result.mimetype == "error")
        throw new Error(result.content);
      return result;
    }).catch((error) => {
      throw new Error(error);
    });
  }
  addDebugSession(session) {
  }
  removeDebugSession(session) {
  }
};

// src/moosebookProvider.ts
var MoosebookContentProvider = class {
  constructor() {
    this.id = "moosebookKernel";
    this.label = "Moosebook Kernel";
    this._associations = new Map();
    this._localDisposables = [];
    this.supportedLanguages = ["pharo"];
    this._executionOrder = 0;
    this._localDisposables.push(vscode4.notebook.onDidOpenNotebookDocument((document) => {
      const docKey = document.uri.toString();
      if (!this.lookupMoosebook(docKey)) {
        const project = new Moosebook(document);
        this.register(docKey, project, (key) => document.cells.some((cell) => cell.index.toString() === key) || key === docKey);
      }
    }), vscode4.notebook.onDidCloseNotebookDocument((document) => {
      const project = this.unregister(document.uri.toString());
      if (project) {
        project.dispose();
      }
    }));
    vscode4.notebook.registerNotebookKernelProvider({
      viewType: "moosebook"
    }, {
      provideKernels: () => {
        return [this];
      }
    });
  }
  interrupt(document) {
    throw new Error("Method not implemented.");
  }
  async executeCellsRequest(document, ranges) {
    const cells = [];
    for (let range of ranges) {
      for (let i = range.start; i < range.end; i++) {
        cells.push(document.cells[i]);
      }
    }
    this._executeCells(cells);
  }
  async _executeCells(cells) {
    for (const cell of cells) {
      const execution = vscode4.notebook.createNotebookCellExecutionTask(cell.notebook.uri, cell.index, this.id);
      await this._doExecuteCell(execution);
    }
  }
  async _doExecuteCell(execution) {
    execution.executionOrder = ++this._executionOrder;
    execution.start({startTime: Date.now()});
    let output = {mimetype: "text/html", content: "error... "};
    let error;
    const moosebook = this.lookupMoosebook(execution.cell.index);
    try {
      output = await moosebook.eval(execution.cell);
    } catch (err) {
      execution.replaceOutput([new vscode4.NotebookCellOutput([
        new vscode4.NotebookCellOutputItem("application/x.notebook.error-traceback", {
          ename: err instanceof Error && err.name || "error",
          evalue: err instanceof Error && err.message || JSON.stringify(err, void 0, 4),
          traceback: []
        })
      ])]);
      execution.end({success: false});
      return;
    }
    execution.replaceOutput([new vscode4.NotebookCellOutput([
      new vscode4.NotebookCellOutputItem(output.mimetype, output.content)
    ])]);
    execution.end({success: true});
  }
  lookupMoosebook(keyOrUri) {
    if (keyOrUri) {
      let key;
      if (typeof keyOrUri === "string") {
        key = keyOrUri;
      } else {
        key = keyOrUri.toString();
      }
      for (let [association, value] of this._associations.values()) {
        if (association(key)) {
          return value;
        }
      }
    }
    return void 0;
  }
  async openNotebook(uri) {
    let contents = "";
    try {
      contents = Buffer.from(await vscode4.workspace.fs.readFile(uri)).toString("utf8");
    } catch {
    }
    let raw;
    try {
      raw = JSON.parse(contents);
    } catch {
      raw = [];
    }
    const notebookData = {
      metadata: new vscode4.NotebookDocumentMetadata().with({editable: true}),
      cells: raw.map((item) => ({
        kind: item.kind,
        source: item.value,
        language: item.language,
        outputs: [],
        metadata: new vscode4.NotebookCellMetadata().with({
          editable: true,
          breakpointMargin: false
        })
      }))
    };
    return notebookData;
  }
  saveNotebook(document, _cancellation) {
    return this._save(document, document.uri);
  }
  saveNotebookAs(targetResource, document, _cancellation) {
    return this._save(document, targetResource);
  }
  async resolveNotebook(_document, _webview) {
  }
  async backupNotebook(document, context, _cancellation) {
    return {id: "", delete: () => {
    }};
  }
  dispose() {
  }
  async _save(document, targetResource) {
    let contents = [];
    for (let cell of document.cells) {
      contents.push({
        kind: cell.kind,
        language: cell.document.languageId,
        value: cell.document.getText()
      });
    }
    await vscode4.workspace.fs.writeFile(targetResource, Buffer.from(JSON.stringify(contents)));
  }
  register(key, project, association) {
    this._associations.set(key, [association, project]);
  }
  unregister(key) {
    const project = this.lookupMoosebook(key);
    if (project) {
      this._associations.delete(key);
    }
    return project;
  }
};

// src/extension.ts
var client;
var socket;
async function activate(context) {
  console.info("Start Pharo Language extension");
  return resolveRequirements().catch((error) => {
    import_vscode.window.showErrorMessage(error.message, error.label).then((selection) => {
      if (error.label && error.label === selection && error.command) {
        import_vscode.commands.executeCommand(error.command, error.commandParam);
      }
    });
  }).then(async (requirements2) => {
    client = createPharoLanguageServer(requirements2, context);
    context.subscriptions.push(client.start());
    import_vscode.window.showInformationMessage("Client started");
    createCommands(context);
    let factory = new DebugAdapterFactory();
    activateDebug(context, factory);
    console.info("Start moosebook");
    const moosebookContentProvider = new MoosebookContentProvider();
    context.subscriptions.push(vscode5.notebook.registerNotebookContentProvider("moosebook", moosebookContentProvider));
  });
}
function createCommands(context) {
  context.subscriptions.push(vscode5.commands.registerCommand("pharo.extensionVersion", commandPharoExtensionVersion));
  context.subscriptions.push(vscode5.commands.registerCommand("pharo.printIt", commandPharoPrintIt));
  context.subscriptions.push(vscode5.commands.registerCommand("pharo.showIt", commandPharoShowIt));
  context.subscriptions.push(vscode5.commands.registerCommand("pharo.save", commandPharoSave));
}
function deactivate() {
}
function commandPharoExtensionVersion() {
  client.sendRequest("command:version").then((result) => {
    console.log(result);
    import_vscode.window.showInformationMessage(result);
  });
}
function commandPharoPrintIt() {
  let editor = vscode5.window.activeTextEditor;
  let selection = editor.selection;
  client.sendRequest("command:printIt", {line: editor.document.getText(selection)}).then((result) => {
    editor.edit((editBuilder) => {
      editBuilder.replace(new vscode5.Selection(selection.end, selection.end), ' "' + result + '" ');
    });
  }).catch((error) => import_vscode.window.showErrorMessage(error));
}
function commandPharoShowIt() {
  let editor = vscode5.window.activeTextEditor;
  client.sendRequest("command:printIt", {line: editor.document.getText(editor.selection)}).then((result) => {
    import_vscode.window.showInformationMessage(result);
  }).catch((error) => import_vscode.window.showErrorMessage(error));
}
function commandPharoSave() {
  client.sendRequest("command:save").then((result) => {
    import_vscode.window.showInformationMessage(result);
  }).catch((error) => import_vscode.window.showErrorMessage(error));
}
function createPharoLanguageServer(requirements2, context) {
  let serverOptions = () => createServerWithSocket(requirements2.pathToVM, requirements2.pathToImage, context);
  let clientOptions = {
    documentSelector: [{scheme: "file", language: "pharo"}],
    synchronize: {
      fileEvents: import_vscode.workspace.createFileSystemWatcher("**/.clientrc")
    }
  };
  return new import_vscode_languageclient.LanguageClient("pharoLanguageServer", "Pharo Language Server", serverOptions, clientOptions);
}
async function createServerWithSocket(pharoPath, pathToImage, context) {
  let dls;
  dls = child_process.spawn(pharoPath.trim(), [
    pathToImage,
    "st",
    context.asAbsolutePath("/res/run-server.st")
  ]);
  await sleep(8e3);
  socket = net.connect({port: 4e3, host: "127.0.0.1"}, () => {
    console.log("connected to server!");
  });
  let result = {
    writer: socket,
    reader: socket
  };
  return Promise.resolve(result);
}
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=extension.js.map
