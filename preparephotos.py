"""
	@author: Esri
	@contact: rcosby@esri.com
	@company: Esri
	@version: 1.0
	@description: Photo Survey Tool to Resize and/or enhance photos
	@requirements: Python 3.5.x and ArcGIS Pro 2.x
	@copyright: Esri, 2017

"""

import arcpy
import preparephotoshelper
from importlib import reload
reload(preparephotoshelper)



def main(arguments):
    #arcpy.AddMessage(preparephotos_helper)
    preparephotoshelper.execute(*arguments)

if __name__ == '__main__':
    inpDir = arcpy.GetParameterAsText(0)
    outputDir = arcpy.GetParameterAsText(1)
    enhBright = arcpy.GetParameter(2)
    imgSize = arcpy.GetParameter(3)

    argv = (inpDir, outputDir, enhBright, imgSize)
    main(argv)
