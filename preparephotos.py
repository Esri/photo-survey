"""
	@author: Esri
	@contact: rcosby@esri.com
	@company: Esri
	@version: 1.0
	@description: Photo Survey Tool to Resize and/or enhance photos
	@requirements: Python 3.5.x and ArcGIS Pro 2.x
	@copyright: Esri, 2017

"""

import os
import glob
import sys
import math
import shutil
import arcpy


# Install the PIL Library from Python Package Manager in ArcGIS Pro:
# Click 'Add Packages' and select 'pil' then 'Install'
from PIL import Image
from PIL import ImageStat
from PIL import ImageEnhance


TARGET_LUM = 100


def getSupportedImages(directory):

    imgTypes = ('jpg', 'jpeg')
    imgList = []
    for img in imgTypes:
        imgList.extend(glob.glob(directory + "/*.{}".format(img)))
   
    return imgList

def processImages(image_list, output_dir, enh, imgS):
    arcpy.SetProgressor("step","Processing Photos...",0,len(image_list))
    for x in image_list:
        newpath = os.path.join(output_dir, os.path.basename(x))
        img = Image.open(x)
        exif = img.info['exif']

        #Resize

        widthSize = imgS
        heightSize = imgS

        (width, height) = img.size  # get the size of the input image

        if width > imgSize or height > imgS: #only resize if height or width is greater than maxdim
            if width > height:
                heightSize = (imgS * height) / width
            elif height > width:
                widthSize = (imgS * width) / height

        img = img.resize((widthSize, int(heightSize)), Image.ANTIALIAS)


        #Enhance Photo
        if enh:
            lum = brightness(img)
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(1.0 + ((TARGET_LUM - lum) / lum))

        img.save(newpath, exif=exif)
        arcpy.SetProgressorPosition()

    return


def brightness(im):
    stat = ImageStat.Stat(im)
    gs = (math.sqrt(0.241 * (r ** 2) + 0.691 * (g ** 2) + 0.068 * (b**2))
          for r, b, g in im.getdata())
    return sum(gs) / stat.count[0]


def main(inputDir, outDir, enh, imgS):
    imgList = getSupportedImages(inputDir)
    if imgList:
        processImages(imgList, outDir, enh, imgS)
    else:
        arcpy.AddError("No images available to process. Check input directory for JPG photos")


if __name__ == '__main__':
    inpDir = arcpy.GetParameterAsText(0)
    outputDir = arcpy.GetParameterAsText(1)
    enhBright = arcpy.GetParameter(2)
    imgSize = arcpy.GetParameter(3)

    argv = (inpDir, outputDir, enhBright, imgSize)
    main(*argv)
