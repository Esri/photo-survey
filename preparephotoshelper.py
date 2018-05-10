import os
import glob
import sys
import math
import shutil
import multiprocessing
# Install the PIL Library from Python Package Manager in ArcGIS Pro:
# Click 'Add Packages' and select 'pil' then 'Install'
from PIL import Image
from PIL import ImageStat
from PIL import ImageEnhance
import arcpy



TARGET_LUM = 100

def getSupportedImages(directory):

    imgTypes = ('jpg', 'jpeg')
    imgList = []
    for img in imgTypes:
        imgList.extend(glob.glob(directory + "/*.{}".format(img)))
    return imgList

def processImage(x, output_dir, enh, imgS):
    #arcpy.SetProgressor("step","Processing Photos...",0,len(image_list))
    # for x in image_list:

    newpath = os.path.join(output_dir, os.path.basename(x))
    img = Image.open(x)
    if 'exif' in img.info:
        exif = img.info['exif']
    else:
        exif = None

    #Resize

    widthSize = imgS
    heightSize = imgS

    (width, height) = img.size  # get the size of the input image

    if width > imgS or height > imgS: #only resize if height or width is greater than maxdim
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
    if exif:
        img.save(newpath, exif=exif)
    else:
        img.save(newpath)
    del img
    #arcpy.SetProgressorPosition()

    return


def brightness(im):
    stat = ImageStat.Stat(im)
    gs = (math.sqrt(0.241 * (r ** 2) + 0.691 * (g ** 2) + 0.068 * (b**2))
          for r, b, g in im.getdata())
    return sum(gs) / stat.count[0]

def execute(inputDir, outDir, enh, imgS):
    imgList = getSupportedImages(inputDir)

    pythonExePath = sys.exec_prefix + "\\pythonw.exe"

    multiprocessing.set_executable(pythonExePath)
    pool = multiprocessing.Pool(processes=int(multiprocessing.cpu_count() / 2))
    
    if imgList:
        pool.starmap(processImage, [(img, outDir, enh, imgS) for img in imgList])
    else:
        arcpy.AddError("No images available to process. Check input directory for JPG photos")