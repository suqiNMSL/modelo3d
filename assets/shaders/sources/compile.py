#!/usr/bin/python

import sys
import string
import os
import re

def printUsage():
  print("Generate GLSL shader sources from our customized one.")
  print("compile.py <shader-name> -D[DEFINES1] -D[DEFINES2] -D[DEFINES3] ...")
  print("Example:")
  print("  compile.py solid -DPHYSICALL_BASED_SHADING")

if len(sys.argv) < 1:
  printUsage()
  exit()

# Parse the command line arguments
shader_file = sys.argv[1]
parameters = sys.argv
parameters = parameters[2:]

vertex_source_file = shader_file + ".mvs"
fragment_source_file = shader_file + ".mfs"

output_vertex_source_file = "../" + shader_file + ".vs"
output_fragment_source_file = "../" + shader_file + ".fs"

print('input vertex source file:    ', vertex_source_file) 
print('input fragment source file:  ', fragment_source_file) 
print('output vertexsource file:    ', output_vertex_source_file) 
print('output fragment source file: ', output_fragment_source_file) 
print('parameters:', str(parameters))

# Check the parameters

# Preprocess defines
defines = []
for parameter in parameters:
  if parameter[:2] != "-D":
    print("Invalidate parameter: " + parameter)
    continue;
  else:
    defines.append(parameter[2:])

# Check if the input file exists
if not os.path.exists(vertex_source_file):
  print("error! " + vertex_source_file + " does not exist")
  print("quitting")
  exit();
if not os.path.exists(fragment_source_file):
  print("error! " + fragment_source_file + " does not exist")
  print("quitting")
  exit();

# modes
NA = 0
NOT_DEFINED = 1
DEFINED = 2

def removeComments(line):
  line1 = line.lstrip(' ')
  if line1[0:2] == '//':
    return ""
  index = line1.rfind('//')
  if index != -1:
    return line1[0:index - 1];
  return line1

def preprocessSource(input_source_file, defines, output_source_file):
  # open output file
  fp = open(output_source_file, "w");
  # read file into lines
  with open(input_source_file) as f:
    content = f.readlines()

  # parse input file line by line
  lineNumber = 1;
  mode = NA
  for line in content:
    lineNumber += 1;

    plain_line = line;
    line = line.lstrip(' \t')
    
    if line[0] == "#": # it is a directive
      if re.match(r"^#include", line[0:]):
        if mode != NOT_DEFINED:
          included = line[8:].strip(' \r\n')
          if not os.path.exists(included):
            print("error! include %s does not exist at line %d" % (included, lineNumber))
            break
          with open(included) as f:
            included_content = f.readlines()
          for line1 in included_content:
            if line1 != "":
              fp.write(line1)

      elif re.match(r"^#ifdef", line[0:]):
        define = line[6:].strip("\r\n ");
        if mode != NA:
          print("error! Not support nested #ifdef/#endif at line %d" % (lineNumber))
          break;
        if define in defines:
          mode = DEFINED
        else:
          mode = NOT_DEFINED

      elif re.match(r"^#else", line[0:]):
        if mode != DEFINED and mode != NOT_DEFINED:
          print("error! Unmatched #ifdef and #endif at line %d" % (lineNumber))
          break;
        # reverse the mode.
        if mode == DEFINED:
          mode = NOT_DEFINED
        if mode == NOT_DEFINED:
          mode = DEFINED

      elif re.match(r"^#endif", line[0:]):
        if mode == DEFINED or mode == NOT_DEFINED:
          mode = NA
        else:
          print("error! At line %d, invalidate directive" % (lineNumber))
          break

      else:
        print("error! unrecognized directive at line %d" % (lineNumber))
        break

    else:
      if mode == DEFINED or mode == NA:
        fp.write(plain_line)
          
  fp.close();
  return

# Process vertex shader source
preprocessSource(vertex_source_file, defines, output_vertex_source_file);
# Process fragment shader source
preprocessSource(fragment_source_file, defines, output_fragment_source_file);



import string
import random
def id_generator(size=6, chars=string.ascii_lowercase+'_'):
  return ''.join(random.choice(chars) for _ in range(size))

#ciphers = {
#    "aPosition": "",
#    "aNormal": "",
#    "aTexCoord0": "",
#    "aColor": "",
#    "vVertex": "",
#    "vNormal": "",
#    "vTexCoord0": "",
#    "vColor": "",
#    }
#used = [];
#for keyword in ciphers:
#  cipher = id_generator(6);
#  while cipher in used:
#    cipher = id_generator(6);
#  used.append(cipher)
#  ciphers[keyword] = cipher
#
#def encryptSource(source_file):
#  with open(source_file) as f:
#    plain_text = f.readlines()
#  with open(source_file, "wt") as f:
#    for line in plain_text:
#      for keyword in ciphers:
#        k = '\\b' + keyword + '\\b'
#        line = re.sub(k, ciphers[keyword], line);
#      f.write(line)
#
## Make it unreadable
#if not debug:
#  encryptSource(output_vertex_source_file);
#  encryptSource(output_fragment_source_file);

# use http://glslunit.appspot.com/compiler.html instead

print("Succeed")

