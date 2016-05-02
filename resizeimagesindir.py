__author__ = 'esri'
#updated script to work with python 3.4 (with Pillow - fork off of PIL)
#https://github.com/tswanson/Photoresize

import PIL
from PIL import Image
import os

# Input Directory
indir = 'C:\\temp\\ImageDir'
outdir = 'C:\\temp\\ImageResize'
MAXSIZE = 1000  # Maximum width or height for your photo

files_in_dir = os.listdir(indir)
for file_in_dir in files_in_dir:

	WIDTHSIZE = MAXSIZE
	HEIGHTSIZE = MAXSIZE

	im = Image.open(indir + "\\" + file_in_dir)  # open the input file
	(width, height) = im.size  # get the size of the input image

	if width > MAXSIZE or height > MAXSIZE:  #only resize if height or width is greater than maxsize
		if width > height:
			HEIGHTSIZE = (MAXSIZE * height) / width
		elif height > width:
			WIDTHSIZE = (MAXSIZE * width) / height

	print
	file_in_dir + " - " + str(width) + " - " + str(height) + " - " + str(WIDTHSIZE) + " - " + str(HEIGHTSIZE)

	im = im.resize((WIDTHSIZE, int(HEIGHTSIZE)), Image.ANTIALIAS)

	im.save(outdir + "\\" + file_in_dir, "jpeg", quality=100)