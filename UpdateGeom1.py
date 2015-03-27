#-------------------------------------------------------------------------------
# Name:        module1
# Purpose:
#
# Author:      chri4819
#
# Created:     20/03/2015
# Copyright:   (c) chri4819 2015
# Licence:     <your licence>
#-------------------------------------------------------------------------------

import arcpy
import math
import os

Workspace = "C:\Git\photo-survey-python\Staging.gdb"
PointFeatureclass = "C:\Git\photo-survey-python\Staging.gdb\PointAttachments"
distance = 15
shape = arcpy.Describe(PointFeatureclass).ShapeFieldName
fields = ['SHAPE@XY', 'Direction']

def shift_features(in_features, x_shift=None, y_shift=None):
    with arcpy.da.UpdateCursor(in_features, fields) as cursor:
        for row in cursor:
            x = row[0][0] + x_shift * math.cos(math.degrees(int(row[1])))
            y = row[0][1] + y_shift * math.sin(math.degrees(int(row[1])))
            row[0] = (x, y)
            cursor.updateRow(row)
    return

shift_features (PointFeatureclass, distance, distance)


