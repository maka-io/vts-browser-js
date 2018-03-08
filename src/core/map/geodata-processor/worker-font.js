

var Typr = {};

Typr.parse = function(buff) {
    var bin = Typr._bin;
    var data = new Uint8Array(buff);
    var offset = 0;
    
    var sfnt_version = bin.readFixed(data, offset);
    offset += 4;
    var numTables = bin.readUshort(data, offset);
    offset += 2;
    var searchRange = bin.readUshort(data, offset);
    offset += 2;
    var entrySelector = bin.readUshort(data, offset);
    offset += 2;
    var rangeShift = bin.readUshort(data, offset);
    offset += 2;
    
    var tags = [
        "cmap",
        "head",
        "hhea",
        "maxp",
        "hmtx",
        "name",
        "OS/2",
        "post",
        
        //"cvt",
        //"fpgm",
        "loca",
        "glyf",
        "kern",
        
        //"prep"
        //"gasp"
        
        "GPOS",
        "GSUB"
        //"VORG",
        ];
    
    var obj = {_data:data};
    //console.log(sfnt_version, numTables, searchRange, entrySelector, rangeShift);
    
    var tabs = {};
    var tablesOffset = 0;
    
    for(var i=0; i<numTables; i++) {
        var tag = bin.readASCII(data, offset, 4);   offset += 4;
        var checkSum = bin.readUint(data, offset);  offset += 4;
        var toffset = bin.readUint(data, offset);   offset += 4;
        var length = bin.readUint(data, offset);    offset += 4;
        tabs[tag] = {offset:toffset, length:length};
        tablesOffset = toffset + length;
        //if(tags.indexOf(tag)==-1) console.log("unknown tag", tag);
    }
    
    for(var i=0; i< tags.length; i++) {
        var t = tags[i];
        //console.log(t);
        //if(tabs[t]) console.log(t, tabs[t].offset, tabs[t].length);
        if(tabs[t]) obj[t.trim()] = Typr[t.trim()].parse(data, tabs[t].offset, tabs[t].length, obj);
    }

    obj._tabs = tabs;

    Typr._processGlyphs(data, tablesOffset, tabs, obj);
    
    return obj;
}

Typr._processGlyphs = function(data, index, tabs, obj) {
    var version = data[index]; index += 1;
    var textureLX = (data[index] << 8) | (data[index+1]); index += 2;
    var textureLY = (data[index] << 8) | (data[index+1]); index += 2;
    var cly = data[index]; index += 1;
    var size = data[index]; index += 1;

    obj.version = version;
    obj.textureLX = textureLX;
    obj.textureLY = textureLY;
    obj.cly = cly;
    obj.size = size;

    var glyphs = new Array(obj.maxp.numGlyphs);
    var fx = 1.0 / textureLX, fy = 1.0 / textureLY;

    for (var i = 0, li = obj.maxp.numGlyphs; i < li; i++) {
        glyphs[i] = Typr._processGlyph(data, index, fx, fy, textureLX, cly, obj, i);
        index += 4;
    }

    obj.glyphs = glyphs;
}

Typr._processGlyph = function(data, index, fx, fy, textureLX, cly, font, glyphIndex) {
    var value = (data[index] << 24) | (data[index+1] << 16) | (data[index+2] << 8) | (data[index+3]);
    var x, y, clx, plane;

    //console.log('index: '+index + ' value: ' + value);

    switch(textureLX) {
        case 2048: // 4 x unit8 x-11bit,y-11bit,clx-6bit,plane-4bit
            x = ((value >> 21) & 2047), y = ((value >> 10) & 2047), clx = ((value >> 4) & 63), plane = (value & 15);
            break;
                   
        case 1024: // 4 x unit8 x-10bit,y-10bit,clx-6bit,plane-6bit
            x = ((value >> 22) & 1023), y = ((value >> 12) & 1023), clx = ((value >> 6) & 63), plane = (value & 63);
            break;

        case 512:   // 4 x unit8 x-9bit,y-9bit,clx-6bit,plane-8bit
            x = ((value >> 23) & 511), y = ((value >> 14) & 511), clx = ((value >> 8) & 63), plane = (value & 255);
            break;

        default:   // 4 x unit8 x-8bit,y-8bit,clx-6bit,plane-10bit
            x = ((value >> 24) & 255), y = ((value >> 16) & 255), clx = ((value >> 10) & 63), plane = (value & 1023);
            break;
    }

    //console.log('load:'+plane);

    var scale = ((font.size/0.75) / font.head.unitsPerEm) * 0.75;
    //var step = Math.round(font.hmtx.aWidth[glyphIndex] * scale);
    var step = font.hmtx.aWidth[glyphIndex] * scale;
    var shift = clx;
    clx = Math.round(step) + shift + 3*2 +6;

    return {
        u1 : (x) * fx,
        v1 : (y * fy) + plane,
        u2 : (x + clx) * fx,
        v2 : ((y + cly) * fy) + plane,
        lx : clx,
        ly : cly,
        shift : shift, 
        step : (step), 
        plane: plane
    };
}

Typr._tabOffset = function(data, tab) {
    var bin = Typr._bin;
    var numTables = bin.readUshort(data, 4);
    var offset = 12;
    for(var i=0; i<numTables; i++) {
        var tag = bin.readASCII(data, offset, 4);   offset += 4;
        var checkSum = bin.readUint(data, offset);  offset += 4;
        var toffset = bin.readUint(data, offset);   offset += 4;
        var length = bin.readUint(data, offset);    offset += 4;
        if(tag==tab) return toffset;
    }
    return 0;
}




Typr._bin = {
    readFixed : function(data, o) {
        return ((data[o]<<8) | data[o+1]) +  (((data[o+2]<<8)|data[o+3])/(256*256+4));
    },

    readF2dot14 : function(data, o) {
        var num = Typr._bin.readShort(data, o);
        return num / 16384;
        
        var intg = (num >> 14), frac = ((num & 0x3fff)/(0x3fff+1));
        return (intg>0) ? (intg+frac) : (intg-frac);
    },

    readInt : function(buff, p) {
        //if(p>=buff.length) throw "error";
        var a = Typr._bin.t.uint8;
        a[0] = buff[p+3];
        a[1] = buff[p+2];
        a[2] = buff[p+1];
        a[3] = buff[p];
        return Typr._bin.t.int32[0];
    },
    
    readInt8 : function(buff, p) {
        //if(p>=buff.length) throw "error";
        var a = Typr._bin.t.uint8;
        a[0] = buff[p];
        return Typr._bin.t.int8[0];
    },

    readShort : function(buff, p) {
        //if(p>=buff.length) throw "error";
        var a = Typr._bin.t.uint8;
        a[1] = buff[p]; a[0] = buff[p+1];
        return Typr._bin.t.int16[0];
    },

    readUshort : function(buff, p) {
        //if(p>=buff.length) throw "error";
        return (buff[p]<<8) | buff[p+1];
    },

    readUshorts : function(buff, p, len) {
        var arr = [];
        for(var i=0; i<len; i++) arr.push(Typr._bin.readUshort(buff, p+i*2));
        return arr;
    },

    readUint : function(buff, p) {
        //if(p>=buff.length) throw "error";
        var a = Typr._bin.t.uint8;
        a[3] = buff[p];  a[2] = buff[p+1];  a[1] = buff[p+2];  a[0] = buff[p+3];
        return Typr._bin.t.uint32[0];
    },

    readUint64 : function(buff, p) {
        //if(p>=buff.length) throw "error";
        return (Typr._bin.readUint(buff, p)*(0xffffffff+1)) + Typr._bin.readUint(buff, p+4);
    },

    readASCII : function(buff, p, l) {   // l : length in Characters (not Bytes)
        //if(p>=buff.length) throw "error";
        var s = "";
        for(var i = 0; i < l; i++) s += String.fromCharCode(buff[p+i]);
        return s;
    },

    readUnicode : function(buff, p, l) {
        //if(p>=buff.length) throw "error";
        var s = "";
        for(var i = 0; i < l; i++)  
        {
            var c = (buff[p++]<<8) | buff[p++];
            s += String.fromCharCode(c);
        }
        return s;
    },

    readBytes : function(buff, p, l) {
        //if(p>=buff.length) throw "error";
        var arr = [];
        for(var i=0; i<l; i++) arr.push(buff[p+i]);
        return arr;
    },

    readASCIIArray : function(buff, p, l) {  // l : length in Characters (not Bytes)
        //if(p>=buff.length) throw "error";
        var s = [];
        for(var i = 0; i < l; i++)  
            s.push(String.fromCharCode(buff[p+i]));
        return s;
    }
};

Typr._bin.t = {
    buff: new ArrayBuffer(8),
};
Typr._bin.t.int8   = new Int8Array  (Typr._bin.t.buff);
Typr._bin.t.uint8  = new Uint8Array (Typr._bin.t.buff);
Typr._bin.t.int16  = new Int16Array (Typr._bin.t.buff);
Typr._bin.t.uint16 = new Uint16Array(Typr._bin.t.buff);
Typr._bin.t.int32  = new Int32Array (Typr._bin.t.buff);
Typr._bin.t.uint32 = new Uint32Array(Typr._bin.t.buff);





// OpenType Layout Common Table Formats

Typr._lctf = {};

Typr._lctf.parse = function(data, offset, length, font, subt) {
    var bin = Typr._bin;
    var obj = {};
    var offset0 = offset;
    var tableVersion = bin.readFixed(data, offset);  offset += 4;
    
    var offScriptList  = bin.readUshort(data, offset);  offset += 2;
    var offFeatureList = bin.readUshort(data, offset);  offset += 2;
    var offLookupList  = bin.readUshort(data, offset);  offset += 2;
    
    
    obj.scriptList  = Typr._lctf.readScriptList (data, offset0 + offScriptList);
    obj.featureList = Typr._lctf.readFeatureList(data, offset0 + offFeatureList);
    obj.lookupList  = Typr._lctf.readLookupList (data, offset0 + offLookupList, subt);
    
    return obj;
}

Typr._lctf.readLookupList = function(data, offset, subt) {
    var bin = Typr._bin;
    var offset0 = offset;
    var obj = [];
    var count = bin.readUshort(data, offset);  offset+=2;

    for(var i=0; i<count; i++) 
    {
        var noff = bin.readUshort(data, offset);  offset+=2;
        var lut = Typr._lctf.readLookupTable(data, offset0 + noff, subt);
        obj.push(lut);
    }
    return obj;
}

Typr._lctf.readLookupTable = function(data, offset, subt) {
    //console.log("Parsing lookup table", offset);
    var bin = Typr._bin;
    var offset0 = offset;
    var obj = {tabs:[]};
    
    obj.ltype = bin.readUshort(data, offset);  offset+=2;
    obj.flag  = bin.readUshort(data, offset);  offset+=2;
    var cnt   = bin.readUshort(data, offset);  offset+=2;
    
    for(var i=0; i<cnt; i++) {
        var noff = bin.readUshort(data, offset);  offset+=2;
        var tab = subt(data, obj.ltype, offset0 + noff);
        //console.log(obj.type, tab);
        obj.tabs.push(tab);
    }
    return obj;
}

Typr._lctf.numOfOnes = function(n) {
    var num = 0;
    for(var i=0; i<32; i++) if(((n>>>i)&1) != 0) num++;
    return num;
}

Typr._lctf.readClassDef = function(data, offset) {
    var bin = Typr._bin;
    var obj = { start:[], end:[], class:[] };
    var format = bin.readUshort(data, offset);  offset+=2;

    if(format==1) {
        var startGlyph  = bin.readUshort(data, offset);  offset+=2;
        var glyphCount  = bin.readUshort(data, offset);  offset+=2;
        for(var i=0; i<glyphCount; i++) {
            obj.start.push(startGlyph+i);
            obj.end  .push(startGlyph+i);
            obj.class.push(bin.readUshort(data, offset));  offset+=2;
        }
    }

    if(format==2) {
        var count = bin.readUshort(data, offset);  offset+=2;
        for(var i=0; i<count; i++) {
            obj.start.push(bin.readUshort(data, offset));  offset+=2;
            obj.end  .push(bin.readUshort(data, offset));  offset+=2;
            obj.class.push(bin.readUshort(data, offset));  offset+=2;
        }
    }
    return obj;
}

Typr._lctf.readValueRecord = function(data, offset, valFmt) {
    var bin = Typr._bin;
    var arr = [];
    arr.push( (valFmt&1) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&1) ? 2 : 0;
    arr.push( (valFmt&2) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&2) ? 2 : 0;
    arr.push( (valFmt&4) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&4) ? 2 : 0;
    arr.push( (valFmt&8) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&8) ? 2 : 0;
    return arr;
}

Typr._lctf.readCoverage = function(data, offset) {
    var bin = Typr._bin;
    var cvg = {};
    cvg.fmt   = bin.readUshort(data, offset);  offset+=2;
    var count = bin.readUshort(data, offset);  offset+=2;
    //console.log("parsing coverage", offset-4, format, count);
    if(cvg.fmt==1) cvg.tab = bin.readUshorts(data, offset, count); 
    if(cvg.fmt==2) cvg.tab = bin.readUshorts(data, offset, count*3);
    return cvg;
}

Typr._lctf.coverageIndex = function(cvg, val) {
    var tab = cvg.tab;
    if(cvg.fmt==1) return tab.indexOf(val);
    
    for(var i=0; i<tab.length; i+=3) {
        var start = tab[i], end = tab[i+1], index = tab[i+2];
        if(start<=val && val<=end) return index + (val-start);
    }
    return -1;
}

Typr._lctf.readFeatureList = function(data, offset) {
    var bin = Typr._bin;
    var offset0 = offset;
    var obj = [];
    
    var count = bin.readUshort(data, offset);  offset+=2;
    
    for(var i=0; i<count; i++) {
        var tag = bin.readASCII(data, offset, 4);  offset+=4;
        var noff = bin.readUshort(data, offset);  offset+=2;
        obj.push({tag: tag.trim(), tab:Typr._lctf.readFeatureTable(data, offset0 + noff)});
    }
    return obj;
}

Typr._lctf.readFeatureTable = function(data, offset) {
    var bin = Typr._bin;
    
    var featureParams = bin.readUshort(data, offset);  offset+=2;   // = 0
    var lookupCount = bin.readUshort(data, offset);  offset+=2;
    
    var indices = [];
    for(var i=0; i<lookupCount; i++) indices.push(bin.readUshort(data, offset+2*i));
    return indices;
}


Typr._lctf.readScriptList = function(data, offset) {
    var bin = Typr._bin;
    var offset0 = offset;
    var obj = {};
    
    var count = bin.readUshort(data, offset);  offset+=2;
    
    for(var i=0; i<count; i++) {
        var tag = bin.readASCII(data, offset, 4);  offset+=4;
        var noff = bin.readUshort(data, offset);  offset+=2;
        obj[tag.trim()] = Typr._lctf.readScriptTable(data, offset0 + noff);
    }
    return obj;
}

Typr._lctf.readScriptTable = function(data, offset) {
    var bin = Typr._bin;
    var offset0 = offset;
    var obj = {};
    
    var defLangSysOff = bin.readUshort(data, offset);  offset+=2;
    obj.default = Typr._lctf.readLangSysTable(data, offset0 + defLangSysOff);
    
    var langSysCount = bin.readUshort(data, offset);  offset+=2;
    
    for(var i=0; i<langSysCount; i++) {
        var tag = bin.readASCII(data, offset, 4);  offset+=4;
        var langSysOff = bin.readUshort(data, offset);  offset+=2;
        obj[tag.trim()] = Typr._lctf.readLangSysTable(data, offset0 + langSysOff);
    }
    return obj;
}

Typr._lctf.readLangSysTable = function(data, offset) {
    var bin = Typr._bin;
    var obj = {};
    
    var lookupOrder = bin.readUshort(data, offset);  offset+=2;
    //if(lookupOrder!=0)  throw "lookupOrder not 0";
    obj.reqFeature = bin.readUshort(data, offset);  offset+=2;
    //if(obj.reqFeature != 0xffff) throw "reqFeatureIndex != 0xffff";
    
    //console.log(lookupOrder, obj.reqFeature);
    
    var featureCount = bin.readUshort(data, offset);  offset+=2;
    obj.features = bin.readUshorts(data, offset, featureCount);
    return obj;
}


Typr.cmap = {};
Typr.cmap.parse = function(data, offset, length) {
    data = new Uint8Array(data.buffer, offset, length);
    offset = 0;

    var offset0 = offset;
    var bin = Typr._bin;
    var obj = {};
    var version   = bin.readUshort(data, offset);  offset += 2;
    var numTables = bin.readUshort(data, offset);  offset += 2;
    
    //console.log(version, numTables);
    
    var offs = [];
    obj.tables = [];
    
    
    for(var i=0; i<numTables; i++) {
        var platformID = bin.readUshort(data, offset);  offset += 2;
        var encodingID = bin.readUshort(data, offset);  offset += 2;
        var noffset = bin.readUint(data, offset);       offset += 4;
        
        var id = "p"+platformID+"e"+encodingID;
        
        //console.log("cmap subtable", platformID, encodingID, noffset);
                
        var tind = offs.indexOf(noffset);
        
        if(tind==-1) {
            tind = obj.tables.length;
            var subt;
            offs.push(noffset);
            var format = bin.readUshort(data, noffset);
            if     (format== 0) subt = Typr.cmap.parse0(data, noffset);
            else if(format== 4) subt = Typr.cmap.parse4(data, noffset);
            else if(format== 6) subt = Typr.cmap.parse6(data, noffset);
            else if(format==12) subt = Typr.cmap.parse12(data,noffset);
            else console.log("unknown format: "+format, platformID, encodingID, noffset);
            obj.tables.push(subt);
        }
        
        if(obj[id]!=null) throw "multiple tables for one platform+encoding";
        obj[id] = tind;
    }
    return obj;
}

Typr.cmap.parse0 = function(data, offset) {
    var bin = Typr._bin;
    var obj = {};
    obj.format = bin.readUshort(data, offset);  offset += 2;
    var len    = bin.readUshort(data, offset);  offset += 2;
    var lang   = bin.readUshort(data, offset);  offset += 2;
    obj.map = [];
    for(var i=0; i<len-6; i++) obj.map.push(data[offset+i]);
    return obj;
}

Typr.cmap.parse4 = function(data, offset) {
    var bin = Typr._bin;
    var offset0 = offset;
    var obj = {};
    
    obj.format = bin.readUshort(data, offset);  offset+=2;
    var length = bin.readUshort(data, offset);  offset+=2;
    var language = bin.readUshort(data, offset);  offset+=2;
    var segCountX2 = bin.readUshort(data, offset);  offset+=2;
    var segCount = segCountX2/2;
    obj.searchRange = bin.readUshort(data, offset);  offset+=2;
    obj.entrySelector = bin.readUshort(data, offset);  offset+=2;
    obj.rangeShift = bin.readUshort(data, offset);  offset+=2;
    obj.endCount   = bin.readUshorts(data, offset, segCount);  offset += segCount*2;
    offset+=2;
    obj.startCount = bin.readUshorts(data, offset, segCount);  offset += segCount*2;
    obj.idDelta = [];
    for(var i=0; i<segCount; i++) {obj.idDelta.push(bin.readShort(data, offset));  offset+=2;}
    obj.idRangeOffset = bin.readUshorts(data, offset, segCount);  offset += segCount*2;
    obj.glyphIdArray = [];
    while(offset< offset0+length) {obj.glyphIdArray.push(bin.readUshort(data, offset));  offset+=2;}
    return obj;
}

Typr.cmap.parse6 = function(data, offset) {
    var bin = Typr._bin;
    var offset0 = offset;
    var obj = {};
    
    obj.format = bin.readUshort(data, offset);  offset+=2;
    var length = bin.readUshort(data, offset);  offset+=2;
    var language = bin.readUshort(data, offset);  offset+=2;
    obj.firstCode = bin.readUshort(data, offset);  offset+=2;
    var entryCount = bin.readUshort(data, offset);  offset+=2;
    obj.glyphIdArray = [];
    for(var i=0; i<entryCount; i++) {obj.glyphIdArray.push(bin.readUshort(data, offset));  offset+=2;}
    
    return obj;
}

Typr.cmap.parse12 = function(data, offset) {
    var bin = Typr._bin;
    var offset0 = offset;
    var obj = {};
    
    obj.format = bin.readUshort(data, offset);  offset+=2;
    offset += 2;
    var length = bin.readUint(data, offset);  offset+=4;
    var lang   = bin.readUint(data, offset);  offset+=4;
    var nGroups= bin.readUint(data, offset);  offset+=4;
    obj.groups = [];
    
    for(var i=0; i<nGroups; i++) {
        var off = offset + i * 12;
        var startCharCode = bin.readUint(data, off+0);
        var endCharCode   = bin.readUint(data, off+4);
        var startGlyphID  = bin.readUint(data, off+8);
        obj.groups.push([  startCharCode, endCharCode, startGlyphID  ]);
    }
    return obj;
}

Typr.glyf = {};
Typr.glyf.parse = function(data, offset, length, font) {
    var obj = [];
    for(var g=0; g<font.maxp.numGlyphs; g++) obj.push(null);
    return obj;
}

Typr.glyf._parseGlyf = function(font, g) {
    var bin = Typr._bin;
    var data = font._data;
    
    var offset = Typr._tabOffset(data, "glyf") + font.loca[g];
        
    if(font.loca[g]==font.loca[g+1]) return null;
        
    var gl = {};
        
    gl.noc  = bin.readShort(data, offset);  offset+=2;      // number of contours
    gl.xMin = bin.readShort(data, offset);  offset+=2;
    gl.yMin = bin.readShort(data, offset);  offset+=2;
    gl.xMax = bin.readShort(data, offset);  offset+=2;
    gl.yMax = bin.readShort(data, offset);  offset+=2;
    
    if(gl.xMin>=gl.xMax || gl.yMin>=gl.yMax) return null;
        
    if(gl.noc>0) {
        gl.endPts = [];
        for(var i=0; i<gl.noc; i++) { gl.endPts.push(bin.readUshort(data,offset)); offset+=2; }
        
        var instructionLength = bin.readUshort(data,offset); offset+=2;
        if((data.length-offset)<instructionLength) return null;
        gl.instructions = bin.readBytes(data, offset, instructionLength);   offset+=instructionLength;
        
        var crdnum = gl.endPts[gl.noc-1]+1;
        gl.flags = [];
        for(var i=0; i<crdnum; i++ ) { 
            var flag = data[offset];  offset++; 
            gl.flags.push(flag); 
            if((flag&8)!=0) {
                var rep = data[offset];  offset++;
                for(var j=0; j<rep; j++) { gl.flags.push(flag); i++; }
            }
        }
        gl.xs = [];
        for(var i=0; i<crdnum; i++) {
            var i8=((gl.flags[i]&2)!=0), same=((gl.flags[i]&16)!=0);  
            if(i8) { 
                gl.xs.push(same ? data[offset] : -data[offset]);  offset++;
            } else {
                if(same) gl.xs.push(0);
                else { gl.xs.push(bin.readShort(data, offset));  offset+=2; }
            }
        }
        gl.ys = [];
        for(var i=0; i<crdnum; i++) {
            var i8=((gl.flags[i]&4)!=0), same=((gl.flags[i]&32)!=0);  
            if(i8) {
                gl.ys.push(same ? data[offset] : -data[offset]);  offset++;
            } else {
                if(same) gl.ys.push(0);
                else { gl.ys.push(bin.readShort(data, offset));  offset+=2; }
            }
        }
        var x = 0, y = 0;
        for(var i=0; i<crdnum; i++) { x += gl.xs[i]; y += gl.ys[i];  gl.xs[i]=x;  gl.ys[i]=y; }
        //console.log(endPtsOfContours, instructionLength, instructions, flags, xCoordinates, yCoordinates);
    } else {
        var ARG_1_AND_2_ARE_WORDS   = 1<<0;
        var ARGS_ARE_XY_VALUES      = 1<<1;
        var ROUND_XY_TO_GRID        = 1<<2;
        var WE_HAVE_A_SCALE         = 1<<3;
        var RESERVED                = 1<<4;
        var MORE_COMPONENTS         = 1<<5;
        var WE_HAVE_AN_X_AND_Y_SCALE= 1<<6;
        var WE_HAVE_A_TWO_BY_TWO    = 1<<7;
        var WE_HAVE_INSTRUCTIONS    = 1<<8;
        var USE_MY_METRICS          = 1<<9;
        var OVERLAP_COMPOUND        = 1<<10;
        var SCALED_COMPONENT_OFFSET = 1<<11;
        var UNSCALED_COMPONENT_OFFSET   = 1<<12;
        
        gl.parts = [];
        var flags;
        do {
            flags = bin.readUshort(data, offset);  offset += 2;
            var part = { m:{a:1,b:0,c:0,d:1,tx:0,ty:0}, p1:-1, p2:-1 };  gl.parts.push(part);
            part.glyphIndex = bin.readUshort(data, offset);  offset += 2;
            if ( flags & ARG_1_AND_2_ARE_WORDS) {
                var arg1 = bin.readShort(data, offset);  offset += 2;
                var arg2 = bin.readShort(data, offset);  offset += 2;
            } else {
                var arg1 = bin.readInt8(data, offset);  offset ++;
                var arg2 = bin.readInt8(data, offset);  offset ++;
            }
            
            if(flags & ARGS_ARE_XY_VALUES) { part.m.tx = arg1;  part.m.ty = arg2; }
            else  {  part.p1=arg1;  part.p2=arg2;  }
            //part.m.tx = arg1;  part.m.ty = arg2;
            //else { throw "params are not XY values"; }
            
            if ( flags & WE_HAVE_A_SCALE ) {
                part.m.a = part.m.d = bin.readF2dot14(data, offset);  offset += 2;    
            } else if ( flags & WE_HAVE_AN_X_AND_Y_SCALE ) {
                part.m.a = bin.readF2dot14(data, offset);  offset += 2; 
                part.m.d = bin.readF2dot14(data, offset);  offset += 2; 
            } else if ( flags & WE_HAVE_A_TWO_BY_TWO ) {
                part.m.a = bin.readF2dot14(data, offset);  offset += 2; 
                part.m.b = bin.readF2dot14(data, offset);  offset += 2; 
                part.m.c = bin.readF2dot14(data, offset);  offset += 2; 
                part.m.d = bin.readF2dot14(data, offset);  offset += 2; 
            }
        } while ( flags & MORE_COMPONENTS ) 
        if (flags & WE_HAVE_INSTRUCTIONS){
            var numInstr = bin.readUshort(data, offset);  offset += 2;
            gl.instr = [];
            for(var i=0; i<numInstr; i++) { gl.instr.push(data[offset]);  offset++; }
        }
    }
    return gl;
}


Typr.GPOS = {};
Typr.GPOS.parse = function(data, offset, length, font) {  return Typr._lctf.parse(data, offset, length, font, Typr.GPOS.subt);  }



Typr.GPOS.subt = function(data, ltype, offset) { // lookup type
    if(ltype!=2) return null;
    
    var bin = Typr._bin, offset0 = offset, tab = {};
    
    tab.format  = bin.readUshort(data, offset);  offset+=2;
    var covOff  = bin.readUshort(data, offset);  offset+=2;
    tab.coverage = Typr._lctf.readCoverage(data, covOff+offset0);
    tab.valFmt1 = bin.readUshort(data, offset);  offset+=2;
    tab.valFmt2 = bin.readUshort(data, offset);  offset+=2;
    var ones1 = Typr._lctf.numOfOnes(tab.valFmt1);
    var ones2 = Typr._lctf.numOfOnes(tab.valFmt2);

    if(tab.format==1) {
        tab.pairsets = [];
        var count = bin.readUshort(data, offset);  offset+=2;
        
        for(var i=0; i<count; i++) {
            var psoff = bin.readUshort(data, offset);  offset+=2;
            psoff += offset0;
            var pvcount = bin.readUshort(data, psoff);  psoff+=2;
            var arr = [];

            for(var j=0; j<pvcount; j++) {
                var gid2 = bin.readUshort(data, psoff);  psoff+=2;
                var value1, value2;
                if(tab.valFmt1!=0) {  value1 = Typr._lctf.readValueRecord(data, psoff, tab.valFmt1);  psoff+=ones1*2;  }
                if(tab.valFmt2!=0) {  value2 = Typr._lctf.readValueRecord(data, psoff, tab.valFmt2);  psoff+=ones2*2;  }
                arr.push({gid2:gid2, val1:value1, val2:value2});
            }
            tab.pairsets.push(arr);
        }
    }

    if(tab.format==2) {
        var classDef1 = bin.readUshort(data, offset);  offset+=2;
        var classDef2 = bin.readUshort(data, offset);  offset+=2;
        var class1Count = bin.readUshort(data, offset);  offset+=2;
        var class2Count = bin.readUshort(data, offset);  offset+=2;
        
        tab.classDef1 = Typr._lctf.readClassDef(data, offset0 + classDef1);
        tab.classDef2 = Typr._lctf.readClassDef(data, offset0 + classDef2);
        
        tab.matrix = [];
        for(var i=0; i<class1Count; i++) {
            var row = [];
            for(var j=0; j<class2Count; j++) {
                var value1 = null, value2 = null;
                if(tab.valFmt1!=0) { value1 = Typr._lctf.readValueRecord(data, offset, tab.valFmt1);  offset+=ones1*2; }
                if(tab.valFmt2!=0) { value2 = Typr._lctf.readValueRecord(data, offset, tab.valFmt2);  offset+=ones2*2; }
                row.push({val1:value1, val2:value2});
            }
            tab.matrix.push(row);
        }
    }
    return tab;
}

Typr.GSUB = {};
Typr.GSUB.parse = function(data, offset, length, font) {  return Typr._lctf.parse(data, offset, length, font, Typr.GSUB.subt);  }


Typr.GSUB.subt = function(data, ltype, offset) { // lookup type
    var bin = Typr._bin, offset0 = offset, tab = {};
    
    if(ltype!=1 && ltype!=4) return null;
    
    tab.fmt  = bin.readUshort(data, offset);  offset+=2;
    var covOff  = bin.readUshort(data, offset);  offset+=2;
    tab.coverage = Typr._lctf.readCoverage(data, covOff+offset0);   // not always is coverage here
    
    if(false) {}
    else if(ltype==1) {
        if(tab.fmt==1) {
            tab.delta = bin.readShort(data, offset);  offset+=2;
        }
        else if(tab.fmt==2) {
            var cnt = bin.readUshort(data, offset);  offset+=2;
            tab.newg = bin.readUshorts(data, offset, cnt);  offset+=tab.newg.length*2;
        }
    }
    else if(ltype==4) {
        tab.vals = [];
        var cnt = bin.readUshort(data, offset);  offset+=2;
        for(var i=0; i<cnt; i++) {
            var loff = bin.readUshort(data, offset);  offset+=2;
            tab.vals.push(Typr.GSUB.readLigatureSet(data, offset0+loff));
        }
        //console.log(tab.coverage);
        //console.log(tab.vals);
    } 
    
    return tab;
}

Typr.GSUB.readChainSubClassSet = function(data, offset) {
    var bin = Typr._bin, offset0 = offset, lset = [];
    var cnt = bin.readUshort(data, offset);  offset+=2;
    for(var i=0; i<cnt; i++) {
        var loff = bin.readUshort(data, offset);  offset+=2;
        lset.push(Typr.GSUB.readChainSubClassRule(data, offset0+loff));
    }
    return lset;
}

Typr.GSUB.readChainSubClassRule= function(data, offset) {
    var bin = Typr._bin, offset0 = offset, rule = {};
    var pps = ["backtrack", "input", "lookahead"];
    for(var pi=0; pi<pps.length; pi++) {
        var cnt = bin.readUshort(data, offset);  offset+=2;  if(pi==1) cnt--;
        rule[pps[pi]]=bin.readUshorts(data, offset, cnt);  offset+= rule[pps[pi]].length*2;
    }
    var cnt = bin.readUshort(data, offset);  offset+=2;
    rule.subst = bin.readUshorts(data, offset, cnt*2);  offset += rule.subst.length*2;
    return rule;
}

Typr.GSUB.readLigatureSet = function(data, offset) {
    var bin = Typr._bin, offset0 = offset, lset = [];
    var lcnt = bin.readUshort(data, offset);  offset+=2;
    for(var j=0; j<lcnt; j++) {
        var loff = bin.readUshort(data, offset);  offset+=2;
        lset.push(Typr.GSUB.readLigature(data, offset0+loff));
    }
    return lset;
}

Typr.GSUB.readLigature = function(data, offset) {
    var bin = Typr._bin, lig = {chain:[]};
    lig.nglyph = bin.readUshort(data, offset);  offset+=2;
    var ccnt = bin.readUshort(data, offset);  offset+=2;
    for(var k=0; k<ccnt-1; k++) {  lig.chain.push(bin.readUshort(data, offset));  offset+=2;  }
    return lig;
}



Typr.head = {};
Typr.head.parse = function(data, offset, length) {
    var bin = Typr._bin;
    var obj = {};
    var tableVersion = bin.readFixed(data, offset);  offset += 4;
    obj.fontRevision = bin.readFixed(data, offset);  offset += 4;
    var checkSumAdjustment = bin.readUint(data, offset);  offset += 4;
    var magicNumber = bin.readUint(data, offset);  offset += 4;
    obj.flags = bin.readUshort(data, offset);  offset += 2;
    obj.unitsPerEm = bin.readUshort(data, offset);  offset += 2;
    obj.created  = bin.readUint64(data, offset);  offset += 8;
    obj.modified = bin.readUint64(data, offset);  offset += 8;
    obj.xMin = bin.readShort(data, offset);  offset += 2;
    obj.yMin = bin.readShort(data, offset);  offset += 2;
    obj.xMax = bin.readShort(data, offset);  offset += 2;
    obj.yMax = bin.readShort(data, offset);  offset += 2;
    obj.macStyle = bin.readUshort(data, offset);  offset += 2;
    obj.lowestRecPPEM = bin.readUshort(data, offset);  offset += 2;
    obj.fontDirectionHint = bin.readShort(data, offset);  offset += 2;
    obj.indexToLocFormat  = bin.readShort(data, offset);  offset += 2;
    obj.glyphDataFormat   = bin.readShort(data, offset);  offset += 2;
    return obj;
}


Typr.hhea = {};
Typr.hhea.parse = function(data, offset, length) {
    var bin = Typr._bin;
    var obj = {};
    var tableVersion = bin.readFixed(data, offset);  offset += 4;
    obj.ascender  = bin.readShort(data, offset);  offset += 2;
    obj.descender = bin.readShort(data, offset);  offset += 2;
    obj.lineGap = bin.readShort(data, offset);  offset += 2;
    
    obj.advanceWidthMax = bin.readUshort(data, offset);  offset += 2;
    obj.minLeftSideBearing  = bin.readShort(data, offset);  offset += 2;
    obj.minRightSideBearing = bin.readShort(data, offset);  offset += 2;
    obj.xMaxExtent = bin.readShort(data, offset);  offset += 2;
    
    obj.caretSlopeRise = bin.readShort(data, offset);  offset += 2;
    obj.caretSlopeRun  = bin.readShort(data, offset);  offset += 2;
    obj.caretOffset    = bin.readShort(data, offset);  offset += 2;
    
    offset += 4*2;
    
    obj.metricDataFormat = bin.readShort (data, offset);  offset += 2;
    obj.numberOfHMetrics = bin.readUshort(data, offset);  offset += 2;
    return obj;
}


Typr.hmtx = {};
Typr.hmtx.parse = function(data, offset, length, font) {
    var bin = Typr._bin;
    var obj = {};
    
    obj.aWidth = [];
    obj.lsBearing = [];
        
    var aw = 0, lsb = 0;
    
    for(var i=0; i<font.maxp.numGlyphs; i++) {
        if(i<font.hhea.numberOfHMetrics) {  aw=bin.readUshort(data, offset);  offset += 2;  lsb=bin.readShort(data, offset);  offset+=2;  }
        obj.aWidth.push(aw);
        obj.lsBearing.push(lsb);
    }
    
    return obj;
}


Typr.kern = {};
Typr.kern.parse = function(data, offset, length, font) {
    var bin = Typr._bin;
    
    var version = bin.readUshort(data, offset);  offset+=2;
    if(version==1) return Typr.kern.parseV1(data, offset-2, length, font);
    var nTables = bin.readUshort(data, offset);  offset+=2;
    
    var map = {glyph1: [], rval:[]};
    for(var i=0; i<nTables; i++) {
        offset+=2;  // skip version
        var length  = bin.readUshort(data, offset);  offset+=2;
        var coverage = bin.readUshort(data, offset);  offset+=2;
        var format = coverage>>>8;
        /* I have seen format 128 once, that's why I do */ format &= 0xf;
        if(format==0) offset = Typr.kern.readFormat0(data, offset, map);
        else throw "unknown kern table format: "+format;
    }
    return map;
}

Typr.kern.parseV1 = function(data, offset, length, font) {
    var bin = Typr._bin;
    
    var version = bin.readFixed(data, offset);  offset+=4;
    var nTables = bin.readUint(data, offset);  offset+=4;
    
    var map = {glyph1: [], rval:[]};
    for(var i=0; i<nTables; i++) {
        var length = bin.readUint(data, offset);   offset+=4;
        var coverage = bin.readUshort(data, offset);  offset+=2;
        var tupleIndex = bin.readUshort(data, offset);  offset+=2;
        var format = coverage>>>8;
        /* I have seen format 128 once, that's why I do */ format &= 0xf;
        if(format==0) offset = Typr.kern.readFormat0(data, offset, map);
        else throw "unknown kern table format: "+format;
    }
    return map;
}

Typr.kern.readFormat0 = function(data, offset, map) {
    var bin = Typr._bin;
    var pleft = -1;
    var nPairs        = bin.readUshort(data, offset);  offset+=2;
    var searchRange   = bin.readUshort(data, offset);  offset+=2;
    var entrySelector = bin.readUshort(data, offset);  offset+=2;
    var rangeShift    = bin.readUshort(data, offset);  offset+=2;
    for(var j=0; j<nPairs; j++) {
        var left  = bin.readUshort(data, offset);  offset+=2;
        var right = bin.readUshort(data, offset);  offset+=2;
        var value = bin.readShort (data, offset);  offset+=2;
        if(left!=pleft) { map.glyph1.push(left);  map.rval.push({ glyph2:[], vals:[] }) }
        var rval = map.rval[map.rval.length-1];
        rval.glyph2.push(right);   rval.vals.push(value);
        pleft = left;
    }
    return offset;
}



Typr.loca = {};
Typr.loca.parse = function(data, offset, length, font) {
    var bin = Typr._bin;
    var obj = [];
    
    var ver = font.head.indexToLocFormat;
    //console.log("loca", ver, length, 4*font.maxp.numGlyphs);
    var len = font.maxp.numGlyphs+1;
    
    if(ver==0) for(var i=0; i<len; i++) obj.push(bin.readUshort(data, offset+(i<<1))<<1);
    if(ver==1) for(var i=0; i<len; i++) obj.push(bin.readUint  (data, offset+(i<<2))   );
    
    return obj;
}


Typr.maxp = {};
Typr.maxp.parse = function(data, offset, length) {
    //console.log(data.length, offset, length);
    
    var bin = Typr._bin;
    var obj = {};
    
    // both versions 0.5 and 1.0
    var ver = bin.readUint(data, offset); offset += 4;
    obj.numGlyphs = bin.readUshort(data, offset);  offset += 2;
    
    // only 1.0
    if(ver == 0x00010000) {
        obj.maxPoints             = bin.readUshort(data, offset);  offset += 2;
        obj.maxContours           = bin.readUshort(data, offset);  offset += 2;
        obj.maxCompositePoints    = bin.readUshort(data, offset);  offset += 2;
        obj.maxCompositeContours  = bin.readUshort(data, offset);  offset += 2;
        obj.maxZones              = bin.readUshort(data, offset);  offset += 2;
        obj.maxTwilightPoints     = bin.readUshort(data, offset);  offset += 2;
        obj.maxStorage            = bin.readUshort(data, offset);  offset += 2;
        obj.maxFunctionDefs       = bin.readUshort(data, offset);  offset += 2;
        obj.maxInstructionDefs    = bin.readUshort(data, offset);  offset += 2;
        obj.maxStackElements      = bin.readUshort(data, offset);  offset += 2;
        obj.maxSizeOfInstructions = bin.readUshort(data, offset);  offset += 2;
        obj.maxComponentElements  = bin.readUshort(data, offset);  offset += 2;
        obj.maxComponentDepth     = bin.readUshort(data, offset);  offset += 2;
    }
    
    return obj;
}


Typr.name = {};
Typr.name.parse = function(data, offset, length) {
    var bin = Typr._bin;
    var obj = {};
    var format = bin.readUshort(data, offset);  offset += 2;
    var count  = bin.readUshort(data, offset);  offset += 2;
    var stringOffset = bin.readUshort(data, offset);  offset += 2;
    
    //console.log(format, count);
    
    var offset0 = offset;
    
    for(var i=0; i<count; i++) {
        var platformID = bin.readUshort(data, offset);  offset += 2;
        var encodingID = bin.readUshort(data, offset);  offset += 2;
        var languageID = bin.readUshort(data, offset);  offset += 2;
        var nameID     = bin.readUshort(data, offset);  offset += 2;
        var length     = bin.readUshort(data, offset);  offset += 2;
        var noffset    = bin.readUshort(data, offset);  offset += 2;
        //console.log(platformID, encodingID, languageID.toString(16), nameID, length, noffset);
        
        var plat = "p"+platformID;//Typr._platforms[platformID];
        if(obj[plat]==null) obj[plat] = {};
        
        var names = [
            "copyright",
            "fontFamily",
            "fontSubfamily",
            "ID",
            "fullName",
            "version",
            "postScriptName",
            "trademark",
            "manufacturer",
            "designer",
            "description",
            "urlVendor",
            "urlDesigner",
            "licence",
            "licenceURL",
            "---",
            "typoFamilyName",
            "typoSubfamilyName",
            "compatibleFull",
            "sampleText",
            "postScriptCID",
            "wwsFamilyName",
            "wwsSubfamilyName",
            "lightPalette",
            "darkPalette"
        ];
        var cname = names[nameID];
        var soff = offset0 + count*12 + noffset;
        var str;
        if(false){}
        else if(platformID == 0) str = bin.readUnicode(data, soff, length/2);
        else if(platformID == 3 && encodingID == 0) str = bin.readUnicode(data, soff, length/2);
        else if(encodingID == 0) str = bin.readASCII  (data, soff, length);
        else if(encodingID == 1) str = bin.readUnicode(data, soff, length/2);
        else if(encodingID == 3) str = bin.readUnicode(data, soff, length/2);
        
        else if(platformID == 1) { str = bin.readASCII(data, soff, length);  console.log("reading unknown MAC encoding "+encodingID+" as ASCII") }
        else throw "unknown encoding "+encodingID + ", platformID: "+platformID;
        
        obj[plat][cname] = str;
        obj[plat]._lang = languageID;
    }
    
    for(var p in obj) if(obj[p]._lang==1033) return obj[p];     // United States
    for(var p in obj) if(obj[p]._lang==   0) return obj[p];
    
    var tname;
    for(var p in obj) { tname=p; break; }
    console.log("returning name table with languageID "+ obj[tname]._lang);
    return obj[tname];
}


Typr["OS/2"] = {};
Typr["OS/2"].parse = function(data, offset, length) {
    var bin = Typr._bin;
    var ver = bin.readUshort(data, offset); offset += 2;
    
    var obj = {};
    if     (ver==0) Typr["OS/2"].version0(data, offset, obj);
    else if(ver==1) Typr["OS/2"].version1(data, offset, obj);
    else if(ver==2 || ver==3 || ver==4) Typr["OS/2"].version2(data, offset, obj);
    else if(ver==5) Typr["OS/2"].version5(data, offset, obj);
    else throw "unknown OS/2 table version: "+ver;
    
    return obj;
}

Typr["OS/2"].version0 = function(data, offset, obj) {
    var bin = Typr._bin;
    obj.xAvgCharWidth = bin.readShort(data, offset); offset += 2;
    obj.usWeightClass = bin.readUshort(data, offset); offset += 2;
    obj.usWidthClass  = bin.readUshort(data, offset); offset += 2;
    obj.fsType = bin.readUshort(data, offset); offset += 2;
    obj.ySubscriptXSize = bin.readShort(data, offset); offset += 2;
    obj.ySubscriptYSize = bin.readShort(data, offset); offset += 2;
    obj.ySubscriptXOffset = bin.readShort(data, offset); offset += 2;
    obj.ySubscriptYOffset = bin.readShort(data, offset); offset += 2; 
    obj.ySuperscriptXSize = bin.readShort(data, offset); offset += 2; 
    obj.ySuperscriptYSize = bin.readShort(data, offset); offset += 2; 
    obj.ySuperscriptXOffset = bin.readShort(data, offset); offset += 2;
    obj.ySuperscriptYOffset = bin.readShort(data, offset); offset += 2;
    obj.yStrikeoutSize = bin.readShort(data, offset); offset += 2;
    obj.yStrikeoutPosition = bin.readShort(data, offset); offset += 2;
    obj.sFamilyClass = bin.readShort(data, offset); offset += 2;
    obj.panose = bin.readBytes(data, offset, 10);  offset += 10;
    obj.ulUnicodeRange1 = bin.readUint(data, offset);  offset += 4;
    obj.ulUnicodeRange2 = bin.readUint(data, offset);  offset += 4;
    obj.ulUnicodeRange3 = bin.readUint(data, offset);  offset += 4;
    obj.ulUnicodeRange4 = bin.readUint(data, offset);  offset += 4;
    obj.achVendID = [bin.readInt8(data, offset), bin.readInt8(data, offset+1),bin.readInt8(data, offset+2),bin.readInt8(data, offset+3)];  offset += 4;
    obj.fsSelection  = bin.readUshort(data, offset); offset += 2;
    obj.usFirstCharIndex = bin.readUshort(data, offset); offset += 2;
    obj.usLastCharIndex = bin.readUshort(data, offset); offset += 2;
    obj.sTypoAscender = bin.readShort(data, offset); offset += 2;
    obj.sTypoDescender = bin.readShort(data, offset); offset += 2;
    obj.sTypoLineGap = bin.readShort(data, offset); offset += 2;
    obj.usWinAscent = bin.readUshort(data, offset); offset += 2;
    obj.usWinDescent = bin.readUshort(data, offset); offset += 2;
    return offset;
}

Typr["OS/2"].version1 = function(data, offset, obj) {
    var bin = Typr._bin;
    offset = Typr["OS/2"].version0(data, offset, obj);
    
    obj.ulCodePageRange1 = bin.readUint(data, offset); offset += 4;
    obj.ulCodePageRange2 = bin.readUint(data, offset); offset += 4;
    return offset;
}

Typr["OS/2"].version2 = function(data, offset, obj) {
    var bin = Typr._bin;
    offset = Typr["OS/2"].version1(data, offset, obj);
    
    obj.sxHeight = bin.readShort(data, offset); offset += 2;
    obj.sCapHeight = bin.readShort(data, offset); offset += 2;
    obj.usDefault = bin.readUshort(data, offset); offset += 2;
    obj.usBreak = bin.readUshort(data, offset); offset += 2;
    obj.usMaxContext = bin.readUshort(data, offset); offset += 2;
    return offset;
}

Typr["OS/2"].version5 = function(data, offset, obj) {
    var bin = Typr._bin;
    offset = Typr["OS/2"].version2(data, offset, obj);

    obj.usLowerOpticalPointSize = bin.readUshort(data, offset); offset += 2;
    obj.usUpperOpticalPointSize = bin.readUshort(data, offset); offset += 2;
    return offset;
}

Typr.post = {};
Typr.post.parse = function(data, offset, length) {
    var bin = Typr._bin;
    var obj = {};
    
    obj.version           = bin.readFixed(data, offset);  offset+=4;
    obj.italicAngle       = bin.readFixed(data, offset);  offset+=4;
    obj.underlinePosition = bin.readShort(data, offset);  offset+=2;
    obj.underlineThickness = bin.readShort(data, offset);  offset+=2;

    return obj;
}


Typr.U = {};

Typr.U.codeToGlyph = function(font, code) {
    var cmap = font.cmap;
    
    
    var tind = -1;
    if(cmap.p0e4!=null) tind = cmap.p0e4;
    else if(cmap.p3e1!=null) tind = cmap.p3e1;
    else if(cmap.p1e0!=null) tind = cmap.p1e0;
    
    if(tind==-1) throw "no familiar platform and encoding!";
    
    var tab = cmap.tables[tind];
    
    if (tab.format==0) {
        if(code>=tab.map.length) return 0;
        return tab.map[code];
    } else if(tab.format==4) {
        var sind = -1;
        for(var i=0; i<tab.endCount.length; i++)   if(code<=tab.endCount[i]){  sind=i;  break;  } 
        if(sind==-1) return 0;
        if(tab.startCount[sind]>code) return 0;
        
        var gli = 0;
        if(tab.idRangeOffset[sind]!=0) gli = tab.glyphIdArray[(code-tab.startCount[sind]) + (tab.idRangeOffset[sind]>>1) - (tab.idRangeOffset.length-sind)];
        else                           gli = code + tab.idDelta[sind];
        return gli & 0xFFFF;
    } else if(tab.format==12) {
        if(code>tab.groups[tab.groups.length-1][1]) return 0;
        for(var i=0; i<tab.groups.length; i++) {
            var grp = tab.groups[i];
            if(grp[0]<=code && code<=grp[1]) return grp[2] + (code-grp[0]);
        }
        return 0;
    }
    else throw "unknown cmap table format "+tab.format;
}


Typr.U.glyphToPath = function(font, gid) {
    var path = { cmds:[], crds:[] };
    if(font.CFF) {
        var state = {x:0,y:0,stack:[],nStems:0,haveWidth:false,width: font.CFF.Private ? font.CFF.Private.defaultWidthX : 0,open:false};
        Typr.U._drawCFF(font.CFF.CharStrings[gid], state, font.CFF, path);
    }
    if(font.glyf) Typr.U._drawGlyf(gid, font, path);
    return path;
}

Typr.U._drawGlyf = function(gid, font, path) {
    var gl = font.glyf[gid];
    if(gl==null) gl = font.glyf[gid] = Typr.glyf._parseGlyf(font, gid);
    if(gl!=null) {
        if(gl.noc>-1) Typr.U._simpleGlyph(gl, path);
        else          Typr.U._compoGlyph (gl, font, path);
    }
}

Typr.U._simpleGlyph = function(gl, p) {
    for(var c=0; c<gl.noc; c++) {
        var i0 = (c==0) ? 0 : (gl.endPts[c-1] + 1);
        var il = gl.endPts[c];
        
        for(var i=i0; i<=il; i++) {
            var pr = (i==i0)?il:(i-1);
            var nx = (i==il)?i0:(i+1);
            var onCurve = gl.flags[i]&1;
            var prOnCurve = gl.flags[pr]&1;
            var nxOnCurve = gl.flags[nx]&1;
            
            var x = gl.xs[i], y = gl.ys[i];
            
            if(i==i0) { 
                if(onCurve) {
                    if(prOnCurve) Typr.U.P.moveTo(p, gl.xs[pr], gl.ys[pr]); 
                    else          {  Typr.U.P.moveTo(p,x,y);  continue;  /*  will do curveTo at il  */  }
                } else {
                    if(prOnCurve) Typr.U.P.moveTo(p,  gl.xs[pr],       gl.ys[pr]        );
                    else          Typr.U.P.moveTo(p, (gl.xs[pr]+x)/2, (gl.ys[pr]+y)/2   ); 
                }
            }

            if(onCurve) {
                if(prOnCurve) Typr.U.P.lineTo(p,x,y);
            } else {
                if(nxOnCurve) Typr.U.P.qcurveTo(p, x, y, gl.xs[nx], gl.ys[nx]); 
                else          Typr.U.P.qcurveTo(p, x, y, (x+gl.xs[nx])/2, (y+gl.ys[nx])/2); 
            }
        }
        Typr.U.P.closePath(p);
    }
}

Typr.U._compoGlyph = function(gl, font, p) {
    for(var j=0; j<gl.parts.length; j++) {
        var path = { cmds:[], crds:[] };
        var prt = gl.parts[j];
        Typr.U._drawGlyf(prt.glyphIndex, font, path);
        
        var m = prt.m;
        for(var i=0; i<path.crds.length; i+=2) {
            var x = path.crds[i  ], y = path.crds[i+1];
            p.crds.push(x*m.a + y*m.b + m.tx);
            p.crds.push(x*m.c + y*m.d + m.ty);
        }

        for(var i=0; i<path.cmds.length; i++) p.cmds.push(path.cmds[i]);
    }
}


Typr.U._getGlyphClass = function(g, cd) {
    for(var i=0; i<cd.start.length; i++) 
        if(cd.start[i]<=g && cd.end[i]>=g) return cd.class[i];
    return 0;
}

Typr.U.getPairAdjustment = function(font, g1, g2) {
    if(font.GPOS) {
        var ltab = null;
        for(var i=0; i<font.GPOS.featureList.length; i++) {
            var fl = font.GPOS.featureList[i];
            if(fl.tag=="kern")
                for(var j=0; j<fl.tab.length; j++) 
                    if(font.GPOS.lookupList[fl.tab[j]].ltype==2) ltab=font.GPOS.lookupList[fl.tab[j]];
        }
        if(ltab) {
            var adjv = 0;
            for(var i=0; i<ltab.tabs.length; i++) {
                var tab = ltab.tabs[i];
                var ind = Typr._lctf.coverageIndex(tab.coverage, g1);
                if(ind==-1) continue;
                var adj;
                if(tab.format==1) {
                    var right = tab.pairsets[ind];
                    for(var j=0; j<right.length; j++) if(right[j].gid2==g2) adj = right[j];
                    if(adj==null) continue;
                } else if(tab.format==2) {
                    var c1 = Typr.U._getGlyphClass(g1, tab.classDef1);
                    var c2 = Typr.U._getGlyphClass(g2, tab.classDef2);
                    var adj = tab.matrix[c1][c2];
                }
                return adj.val1[2];
            }
        }
    }
    if(font.kern) {
        var ind1 = font.kern.glyph1.indexOf(g1);
        if(ind1!=-1) {
            var ind2 = font.kern.rval[ind1].glyph2.indexOf(g2);
            if(ind2!=-1) return font.kern.rval[ind1].vals[ind2];
        }
    }
    
    return 0;
}

Typr.U.isRTL = function(str) {           
    var weakChars       = '\u0000-\u0040\u005B-\u0060\u007B-\u00BF\u00D7\u00F7\u02B9-\u02FF\u2000-\u2BFF\u2010-\u2029\u202C\u202F-\u2BFF',
        rtlChars        = '\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC',
        rtlDirCheck     = new RegExp('^['+weakChars+']*['+rtlChars+']');

    return rtlDirCheck.test(str);
};

Typr.U.stringToGlyphs = function(fonts, str) {
    var gls = [], g, i, li, j, lj, gsub, font, llist, flist;
    var gfonts = [];

    for (i = 0, li = str.length; i < li; i++) {
        for (j = 0, lj = fonts.length; j < lj; j++) {
            font = fonts[j];
            g = Typr.U.codeToGlyph(font, str.charCodeAt(i));
            if (g) {
                break;
            }
        }

        gls.push(g);
        gfonts.push(g ? j : 0);
    }

    font = null;
    
    //console.log(gls);  return gls;
   
    var wsep = "\n\t\" ,.:;!?()  ،";
    var R = "آأؤإاةدذرزوٱٲٳٵٶٷڈډڊڋڌڍڎڏڐڑڒړڔڕږڗژڙۀۃۄۅۆۇۈۉۊۋۍۏےۓەۮۯܐܕܖܗܘܙܞܨܪܬܯݍݙݚݛݫݬݱݳݴݸݹࡀࡆࡇࡉࡔࡧࡩࡪࢪࢫࢬࢮࢱࢲࢹૅેૉ૊૎૏ૐ૑૒૝ૡ૤૯஁ஃ஄அஉ஌எஏ஑னப஫஬";
    var L = "ꡲ્૗";
    
    for(var ci = 0; ci < gls.length; ci++) {
        var gl = gls[ci];

        if (font != gfonts[ci]) {
            font = fonts[gfonts[ci]];

            gsub = font["GSUB"];
            if(!gsub) {
                continue;
            }

            llist = gsub.lookupList, flist = gsub.featureList;
        }

        if(!gsub) {
            continue;
        }
        
        var slft = ci==0            || wsep.indexOf(str[ci-1])!=-1;
        var srgt = ci==gls.length-1 || wsep.indexOf(str[ci+1])!=-1;
        
        if(!slft && R.indexOf(str[ci-1])!=-1) slft=true;
        if(!srgt && R.indexOf(str[ci  ])!=-1) srgt=true;
        
        if(!srgt && L.indexOf(str[ci+1])!=-1) srgt=true;
        if(!slft && L.indexOf(str[ci  ])!=-1) slft=true;
        
        var feat = null;
        if(slft) feat = srgt ? "isol" : "init";
        else     feat = srgt ? "fina" : "medi";
        
        for(var fi = 0; fi < flist.length; fi++) {
            if(flist[fi].tag != feat) continue;

            for(var ti = 0; ti < flist[fi].tab.length; ti++) {
                var tab = llist[flist[fi].tab[ti]];
                if(tab.ltype != 1) continue;

                for(var j = 0; j < tab.tabs.length; j++) {
                    var ttab = tab.tabs[j];
                    var ind = Typr._lctf.coverageIndex(ttab.coverage,gl);
                    if(ind == -1) continue;  

                    if(ttab.fmt == 0) {
                        gls[ci] = ind+ttab.delta;
                    } else {
                        if (!ttab.newg) {
                            gls[ci] = gl;
                            console.log(ci, gl, "subst-error", flist[fi].tag, i, j, ' original:', str);
                        } else {
                            gls[ci] = ttab.newg[ind];
                        }
                    }

                    //console.log(ci, gl, "subst", flist[fi].tag, i, j, ttab.newg[ind]);
                }
            }
        }
    }

    var cligs = ["rlig", "liga"];
    
    for(var ci=0; ci<gls.length; ci++) {
        var gl = gls[ci];
        var rlim = Math.min(3, gls.length-ci-1);

        if(!gsub) {
            continue;
        }

        if (font != gfonts[ci]) {
            font = fonts[gfonts[ci]];

            gsub = font["GSUB"];
            if(!gsub) {
                continue;
            }

            llist = gsub.lookupList, flist = gsub.featureList;
        }

        for(var fi=0; fi<flist.length; fi++) {
            var fl = flist[fi];
            if(cligs.indexOf(fl.tag)==-1) continue;

            for(var ti=0; ti<fl.tab.length; ti++) {
                var tab = llist[fl.tab[ti]];
                if(tab.ltype!=4) continue;

                for(var j=0; j<tab.tabs.length; j++) {
                    var ind = Typr._lctf.coverageIndex(tab.tabs[j].coverage, gl);
                    if(ind==-1) continue;  

                    var vals = tab.tabs[j].vals[ind];
                    
                    for(var k=0; k<vals.length; k++) {
                        var lig = vals[k], rl = lig.chain.length;  if(rl>rlim) continue;
                        var good = true;
                        for(var l=0; l<rl; l++) if(lig.chain[l]!=gls[ci+(1+l)]) good=false;
                        if(!good) continue;
                        gls[ci]=lig.nglyph;
                        for(var l=0; l<rl; l++) gls[ci+l+1]=-1;
                        //console.log("lig", fl.tag,  gl, lig.chain, lig.nglyph);
                    }
                }
            }
        }
    }

    if (Typr.U.isRTL(str)) {
        gls.reverse();
    }

    return [gls, gfonts];
}

Typr.U.glyphsToPath = function(font, gls) {   
    //gls = gls.reverse();//gls.slice(0,12).concat(gls.slice(12).reverse());
    
    var tpath = {cmds:[], crds:[]};
    var x = 0;
    
    for(var i=0; i<gls.length; i++) {
        var gid = gls[i];  if(gid==-1) continue;
        var gid2 = (i<gls.length-1 && gls[i+1]!=-1)  ? gls[i+1] : 0;
        var path = Typr.U.glyphToPath(font, gid);
        
        for(var j=0; j<path.crds.length; j+=2) {
            tpath.crds.push(path.crds[j] + x);
            tpath.crds.push(path.crds[j+1]);
        }
        for(var j=0; j<path.cmds.length; j++) tpath.cmds.push(path.cmds[j]);
        x += font.hmtx.aWidth[gid];
        if(i<gls.length-1) x += Typr.U.getPairAdjustment(font, gid, gid2);
    }
    return tpath;
}

Typr.U.pathToSVG = function(path, prec) {
    if(prec==null) prec = 5;
    var out = [], co = 0, lmap = {"M":2,"L":2,"Q":4,"C":6};
    for(var i=0; i<path.cmds.length; i++) {
        var cmd = path.cmds[i], cn = co+(lmap[cmd]?lmap[cmd]:0);  
        out.push(cmd);
        while(co<cn) {  var c = path.crds[co++];  out.push(parseFloat(c.toFixed(prec))+(co==cn?"":" "));  }
    }
    return out.join("");
}

Typr.U.pathToContext = function(path, ctx, pos, scale) {
    var c = 0, crds = path.crds;
    
    for(var j=0; j<path.cmds.length; j++) {
        var cmd = path.cmds[j];
        if (cmd=="M") {
            ctx.moveTo((crds[c] * scale) + pos[0] , (crds[c+1] * -scale) + pos[1] );
            c+=2;
        } else if(cmd=="L") {
            ctx.lineTo((crds[c] * scale) + pos[0] , (crds[c+1] * -scale) + pos[1] );
            c+=2;
        } else if(cmd=="C") {
            ctx.bezierCurveTo((crds[c] * scale) + pos[0] , (crds[c+1] * -scale) + pos[1] ,
                              (crds[c+2] * scale) + pos[0] , (crds[c+3] * -scale) + pos[1] ,
                              (crds[c+4] * scale) + pos[0] , (crds[c+5] * -scale) + pos[1] );
            c+=6;
        } else if(cmd=="Q") {
            ctx.quadraticCurveTo((crds[c] * scale) + pos[0] , (crds[c+1] * -scale) + pos[1] ,
                                 (crds[c+2] * scale) + pos[0] , (crds[c+3] * -scale) + pos[1] );
            c+=4;
        } else if(cmd=="Z")  ctx.closePath();
    }
}


Typr.U.P = {};
Typr.U.P.moveTo = function(p, x, y) {
    p.cmds.push("M");  p.crds.push(x,y);
}

Typr.U.P.lineTo = function(p, x, y) {
    p.cmds.push("L");  p.crds.push(x,y);
}

Typr.U.P.curveTo = function(p, a,b,c,d,e,f) {
    p.cmds.push("C");  p.crds.push(a,b,c,d,e,f);
}

Typr.U.P.qcurveTo = function(p, a,b,c,d) {
    p.cmds.push("Q");  p.crds.push(a,b,c,d);
}

Typr.U.P.closePath = function(p) {  p.cmds.push("Z");  }

export {Typr};



