# -*- coding: utf-8 -*-
import argparse
import os
import glob
import sys
import random
import pickle
import math
import shutil
import numpy as np
import arcpy


# Install the PIL Library from Python Package Manager in ArcGIS Pro:
# Click 'Add Packages' and select 'pil' then 'Install'
from PIL import Image
from PIL import ImageStat
from PIL import ImageEnhance


TARGET_LUM = 100
MAXDIM = 640


def get_train_test(positives_dir):
    pos = {x: True for x in glob.glob(positives_dir + '/*')}

    all_dict = pos
    test_filenames = all_dict.keys()

    return {x: all_dict[x] for x in test_filenames}


def preprocess(image_dict, output_dir):
    preprocessed = {}
    arcpy.SetProgressor("step","Processing Photos...",1,len(image_dict))
    for x, label in image_dict.items():
        newpath = os.path.join(output_dir, os.path.basename(x))
        img = Image.open(x)
        exif = img.info['exif']

        #Resize

        widthSize = MAXDIM
        heightSize = MAXDIM

        (width, height) = img.size  # get the size of the input image

        if width > MAXDIM or height > MAXDIM: #only resize if height or width is greater than maxdim
            if width > height:
                heightSize = (MAXDIM * height) / width
            elif height > width:
                widthSize = (MAXDIM * width) / height

        img = img.resize((widthSize, int(heightSize)), Image.ANTIALIAS)


        #Enhance Photo

        lum = brightness(img)
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(1.0 + ((TARGET_LUM - lum) / lum))

        img.save(newpath, exif=exif)
        arcpy.SetProgressorPosition()
        preprocessed[newpath] = label

    return preprocessed


def brightness(im):
    stat = ImageStat.Stat(im)
    gs = (math.sqrt(0.241 * (r ** 2) + 0.691 * (g ** 2) + 0.068 * (b**2))
          for r, b, g in im.getdata())
    return sum(gs) / stat.count[0]


def main(inputDir, outputDir):
    test_images = get_train_test(inputDir)
    print('got {0} test images'.format(len(test_images)))

    #if os.path.exists(outputDir):
        #shutil.rmtree(outputDir)
    #os.mkdir(os.path.join(outputDir))

    test_pre = preprocess(test_images, outputDir)


if __name__ == '__main__':
    argv = tuple(arcpy.GetParameterAsText(i)
                 for i in range(arcpy.GetArgumentCount()))
    main(*argv)
