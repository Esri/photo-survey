"""
	@author: Esri
	@contact: cbuscaglia@esri.com
	@company: Esri
	@version: 2.0
	@description: Photo Survey Tool to load photos
	@requirements: Python 2.7.x or higher, ArcGIS ArcMap 10.2, 10.3.x, 10.4, ArcGIS Pro 2.0 and above (also ArcGIS Pro)
	@copyright: Esri, 2015

"""
# Import modules

import arcpy
import math
import sys, os
from os.path import join

arcpy.env.overwriteOutput = True

# Script arguments (set in the GP tool)

CameraInput = arcpy.GetParameterAsText(0)
SinglePhotos = arcpy.GetParameterAsText(1)
Location = arcpy.GetParameterAsText(2)
PassengerPhotos = arcpy.GetParameterAsText(3)
DriverPhotos = arcpy.GetParameterAsText(4)
AngleField = arcpy.GetParameterAsText(5)
Geodatabase = arcpy.GetParameterAsText(6)
Parcels = arcpy.GetParameterAsText(7)
ParcelPIN = arcpy.GetParameterAsText(8)
TemplateGDB = arcpy.GetParameterAsText(9)

# Retrieve Template Feature Class and Template Questions Table from Template Geodatabase
arcpy.env.workspace = TemplateGDB
TemplateFC = arcpy.ListFeatureClasses()
TemplateQTable = arcpy.ListTables()
TemplateFC = TemplateGDB + "\\" + TemplateFC[0]
TemplateQTable = TemplateGDB +"\\" + TemplateQTable[0]

arcpy.AddMessage("Step 1:  Loading input parameters")

if str (AngleField) == 'true':
	AngleField = 'Direction'
else:
	AngleField = ''

if CameraInput == 'Associate Photo with Parcel':

	# ______________________________________________________________________________#
	#
	# Convert Passenger Photos to Points
	#_______________________________________________________________________________#

	PhotoFeatureClass = """{}\\PointAttachmentsTemp""".format(Geodatabase)
	arcpy.GeoTaggedPhotosToPoints_management(PassengerPhotos, PhotoFeatureClass, "", "ONLY_GEOTAGGED", "NO_ATTACHMENTS")

	#______________________________________________________________________________#
	#
	# If Name is used for ParcelPIN make adjustments
	#______________________________________________________________________________#

	if ParcelPIN is "Name":
		arcpy.AlterField_management(PhotoFeatureClass, ParcelPIN, "Image_Name")
	else:
		pass

	SR = arcpy.Describe(Parcels)
	SRHelper = SR.spatialReference
	PhotoFeatureClass2 = """{}\\PointAttachments""".format(Geodatabase)

	arcpy.Project_management(PhotoFeatureClass, PhotoFeatureClass2, SRHelper)
	arcpy.DeleteIdentical_management(PhotoFeatureClass2, "Shape")
	arcpy.Delete_management(PhotoFeatureClass)

	EntGDB = arcpy.Describe(Geodatabase)
	EntGDB.workspaceType

	if EntGDB is 'RemoteDatabase':
		arcpy.RegisterAsVersioned_management(PhotoFeatureClass2)
	else:
		pass

	arcpy.AddMessage("Step 2:  Converting Photos to points")

	# Load up the parcel dataset for the property association (and make a copy)

	ParcelsFeatureClass = """{}\\Parcels""".format(Geodatabase)
	arcpy.CopyFeatures_management(Parcels, ParcelsFeatureClass)

	arcpy.AddMessage("Step 3:  Copying Parcels to staging geodatabase")

	# Snap Passenger Photos to nearest parcel edge (30ft. default)

	shape = arcpy.Describe(PhotoFeatureClass2).ShapeFieldName
	fields = ['SHAPE@XY', AngleField]

	def shift_photopoints(in_features, x_shift=None, y_shift=None):
		with arcpy.da.UpdateCursor(in_features, fields) as cursor:
			for row in cursor:
				x = row[0][0] + x_shift * math.cos(math.degrees(int(row[1])))
				y = row[0][1] + y_shift * math.sin(math.degrees(int(row[1])))
				row[0] = (x, y)
				cursor.updateRow(row)
		return


	if AngleField:

		shift_photopoints(PhotoFeatureClass2, 15, 15)

	else:

		pass

	snapenv = [ParcelsFeatureClass, "EDGE", "30 Feet"]
	arcpy.Snap_edit(PhotoFeatureClass2, [snapenv])


	Nearhelper = """{}\\NEAR""".format(Geodatabase)
	NEAR = Nearhelper
	arcpy.GenerateNearTable_analysis(PhotoFeatureClass2, ParcelsFeatureClass, NEAR,
									 "5 Feet", "NO_LOCATION", "NO_ANGLE", "CLOSEST", "0", "GEODESIC")

	arcpy.AddMessage("Step 4:  Associating passenger photo points to nearest parcel")

	arcpy.JoinField_management(NEAR, "NEAR_FID", ParcelsFeatureClass, "OBJECTID", ParcelPIN)

	# Export non-matched Photos to table (no GPS, wrong attributes, etc.)

	arcpy.JoinField_management(PhotoFeatureClass2, "OBJECTID", NEAR, "IN_FID")
	arcpy.TableToTable_conversion(PhotoFeatureClass2, Geodatabase,
								  "NonMatchedPassengerPhotos", "{0} is Null".format(ParcelPIN), "")
	arcpy.AddMessage("Step 5:  Reporting non-matched passenger photos to table")


	# Cleanup matched Photos (intermediate data)

	arcpy.DeleteField_management(PhotoFeatureClass2, "IN_FID;NEAR_FID;NEAR_DIST")
	arcpy.AddField_management(PhotoFeatureClass2, "REVERSE", "TEXT", "", "", "5", "", "NULLABLE", "NON_REQUIRED", "")
	arcpy.CalculateField_management(PhotoFeatureClass2, "REVERSE", "\"YES\"", "PYTHON", "")
	arcpy.Delete_management(NEAR)

	#______________________________________________________________________________#
	#
	# Convert Driver Photos to Points
	#______________________________________________________________________________#

	PhotoFeatureClass = """{}\\PointAttachmentsTemp""".format(Geodatabase)
	arcpy.GeoTaggedPhotosToPoints_management(DriverPhotos, PhotoFeatureClass, "", "ONLY_GEOTAGGED", "NO_ATTACHMENTS")

	#______________________________________________________________________________#
	#
	# If Name is used for ParcelPIN make adjustments
	#______________________________________________________________________________#

	if ParcelPIN is "Name":
		arcpy.AlterField_management(PhotoFeatureClass, ParcelPIN, "Image_Name")
	else:
		pass

	SR = arcpy.Describe(Parcels)
	SRHelper = SR.spatialReference
	PhotoFeatureClass3 = """{}\\PointAttachments2""".format(Geodatabase)

	arcpy.Project_management(PhotoFeatureClass, PhotoFeatureClass3, SRHelper)
	arcpy.DeleteIdentical_management(PhotoFeatureClass3, "Shape")
	arcpy.Delete_management(PhotoFeatureClass)
	arcpy.MakeFeatureLayer_management(ParcelsFeatureClass, "PARCELSFL")
	arcpy.SelectLayerByLocation_management("PARCELSFL", "INTERSECT", PhotoFeatureClass2, "", "NEW_SELECTION", "INVERT")
	arcpy.MakeFeatureLayer_management("PARCELSFL", "PARCELSFL2")

	# Snap Driver Photos to nearest parcel edge (100 ft. default)

	shape = arcpy.Describe(PhotoFeatureClass3).ShapeFieldName
	fields = ['SHAPE@XY', AngleField]


	def shift_photopoints(in_features, x_shift=None, y_shift=None):
		with arcpy.da.UpdateCursor(in_features, fields) as cursor:
			for row in cursor:
				x = row[0][0] + x_shift * math.cos(math.degrees(int(row[1])))
				y = row[0][1] + y_shift * math.sin(math.degrees(int(row[1])))
				row[0] = (x, y)
				cursor.updateRow(row)
		return


	if AngleField:

		shift_photopoints(PhotoFeatureClass3, 15, 15)

	else:

		pass

	snapenv = ["PARCELSFL2", "EDGE", "100 Feet"]
	arcpy.Snap_edit(PhotoFeatureClass3, [snapenv])

	Nearhelper = """{}\\NEAR""".format(Geodatabase)
	NEAR = Nearhelper
	arcpy.GenerateNearTable_analysis(PhotoFeatureClass3, ParcelsFeatureClass, NEAR,
									 "5 Feet", "NO_LOCATION", "NO_ANGLE", "CLOSEST", "0", "GEODESIC")
	arcpy.AddMessage("Step 6:  Associating driver photo points to nearest parcel")
	arcpy.JoinField_management(NEAR, "NEAR_FID", ParcelsFeatureClass, "OBJECTID", ParcelPIN)

	# Export non-matched Photos to table (no GPS, wrong attributes, etc.)

	arcpy.JoinField_management(PhotoFeatureClass3, "OBJECTID", NEAR, "IN_FID")
	arcpy.TableToTable_conversion(PhotoFeatureClass3, Geodatabase, "NonMatchedDriverPhotos",
								  "{0} is Null".format(ParcelPIN), "")

	arcpy.AddMessage("Step 7:  Reporting non-matched driver photos to table")

	# Cleanup matched Photos (intermediate data)

	arcpy.DeleteField_management(PhotoFeatureClass3, "IN_FID;NEAR_FID;NEAR_DIST")
	arcpy.Delete_management(NEAR)
	arcpy.AddField_management(PhotoFeatureClass2, "Path2", "TEXT", "", "", "150", "", "NULLABLE", "NON_REQUIRED", "")
	arcpy.CalculateField_management(PhotoFeatureClass2, "Path2", "!Path!", "PYTHON", "")
	arcpy.AddField_management(PhotoFeatureClass3, "Path2", "TEXT", "", "", "150", "", "NULLABLE", "NON_REQUIRED", "")
	arcpy.CalculateField_management(PhotoFeatureClass3, "Path2", "!Path!", "PYTHON", "")
	arcpy.DeleteField_management(PhotoFeatureClass2, "Path")
	arcpy.DeleteField_management(PhotoFeatureClass3, "Path")
	arcpy.AddField_management(PhotoFeatureClass3, "REVERSE", "TEXT", "", "", "5", "", "NULLABLE", "NON_REQUIRED", "")
	arcpy.CalculateField_management(PhotoFeatureClass3, "REVERSE", "\"NO\"", "PYTHON", "")

	arcpy.Append_management(PhotoFeatureClass2, PhotoFeatureClass3, "NO_TEST", "", "")

	#Create Photo Attachments

	ParcelPointClassHelper = """{}\\PointsTemp""".format(Geodatabase)
	ParcelPointHelper = """{}\\PhotoPoints""".format(Geodatabase)
	arcpy.FeatureClassToFeatureClass_conversion(TemplateFC,Geodatabase,"PhotoPoints")
	arcpy.DefineProjection_management(ParcelPointHelper, SRHelper)
	arcpy.AddField_management(ParcelPointHelper, ParcelPIN, "TEXT", "", "", "50", ParcelPIN, "NULLABLE", "NON_REQUIRED")
	arcpy.FeatureToPoint_management(ParcelsFeatureClass, ParcelPointClassHelper, "INSIDE")
else:
	pass

if CameraInput == 'Associate Geotagged Photo with Point (photo has location)':

	# ______________________________________________________________________________#
	#
	# Convert Photos to Points
	#_______________________________________________________________________________#

	ParcelPointHelper = """{}\\PhotoPoints""".format(Geodatabase)
	arcpy.FeatureClassToFeatureClass_conversion(TemplateFC,Geodatabase,"PhotoPoints")
else:
	pass


if CameraInput == 'Associate Non-Geotagged Photo with specified Point (no location)':

	# ______________________________________________________________________________#
	#
	# Convert Photos to Pointsw/ no coordinates
	#_______________________________________________________________________________#

	ParcelPointHelper = """{}\\PhotoPoints""".format(Geodatabase)
	arcpy.FeatureClassToFeatureClass_conversion(TemplateFC,Geodatabase,"PhotoPoints")
else:
	pass

if CameraInput == "Associate Photo with Parcel":
	arcpy.AddMessage("Step 8:  Adding survey question fields")
else:
	arcpy.AddMessage("Step 2:  Adding Survey question fields")

if CameraInput == 'Associate Photo with Parcel':

	arcpy.Append_management(ParcelPointClassHelper, ParcelPointHelper, "NO_TEST")
	arcpy.AddField_management(ParcelPointHelper, "REVERSE", "TEXT", "", "", "5", "", "NULLABLE", "NON_REQUIRED", "")
	arcpy.JoinField_management(ParcelPointHelper, ParcelPIN, PhotoFeatureClass3, ParcelPIN)
	arcpy.CalculateField_management(ParcelPointHelper, "REVERSE", "!REVERSE_1!", "PYTHON", "")
	arcpy.EnableAttachments_management(ParcelPointHelper)
	arcpy.AddAttachments_management(ParcelPointHelper, ParcelPIN, PhotoFeatureClass3, ParcelPIN, "Path2", "")
	arcpy.AddMessage("Step 9:  Creating photo attachments")

else:
	pass

if CameraInput == 'Associate Geotagged Photo with Point (photo has location)':

    arcpy.AddMessage("Step 3:  Adding application required fields")
    arcpy.AddField_management(ParcelPointHelper, "BSTPHOTOID", "TEXT", "", "", "25", "Best Photo Identifier", "NULLABLE", "NON_REQUIRED", "")
    arcpy.AddField_management(ParcelPointHelper, "SRVNAME", "TEXT", "", "", "25", "Surveyor Name", "NULLABLE", "NON_REQUIRED", "")
    arcpy.AddMessage("Step 4:  Finalizing photo survey feature class")
    arcpy.AddMessage("Step 5:  Creating Photo Attachments")
    ParcelPointHelperTemp = """{}\\ParcelPointsTemp""".format(Geodatabase)
    ParcelPointsMerged = """{}\\ParcelPointsMerged""".format(Geodatabase)
    arcpy.GeoTaggedPhotosToPoints_management(SinglePhotos, ParcelPointHelperTemp, "", "ONLY_GEOTAGGED", "NO_ATTACHMENTS")
    arcpy.Merge_management(ParcelPointHelperTemp + ';' + ParcelPointHelper, ParcelPointsMerged)
    PointsMerged2 = """{}\\PhotoPoint""".format(Geodatabase)
    arcpy.Rename_management(ParcelPointsMerged, PointsMerged2)
    arcpy.EnableAttachments_management(PointsMerged2)
    arcpy.AddAttachments_management(PointsMerged2, "OBJECTID", PointsMerged2, "OBJECTID", "Path", "")
    arcpy.Delete_management(ParcelPointHelperTemp)
    arcpy.Delete_management(ParcelPointHelper)
    arcpy.DeleteField_management(PointsMerged2, "Path")
    arcpy.Rename_management(PointsMerged2, ParcelPointHelper)


else:
	pass

if CameraInput == 'Associate Non-Geotagged Photo with specified Point (no location)':


    arcpy.AddMessage("Step 3:  Adding application required fields")
    arcpy.AddField_management(ParcelPointHelper, "BSTPHOTOID", "TEXT", "", "", "25", "Best Photo Identifier", "NULLABLE", "NON_REQUIRED", "")
    arcpy.AddField_management(ParcelPointHelper, "SRVNAME", "TEXT", "", "", "25", "Surveyor Name", "NULLABLE", "NON_REQUIRED", "")
    arcpy.AddMessage("Step 4:  Finalizing photo survey feature class")
    arcpy.AddMessage("Step 5:  Creating Photo Attachments")
    PointHelperTemp = """{}\\PointsTemp""".format(Geodatabase)
    PointsMerged = """{}\\PointsMerged""".format(Geodatabase)
    arcpy.GeoTaggedPhotosToPoints_management(SinglePhotos, PointHelperTemp, "", "ALL_PHOTOS", "NO_ATTACHMENTS")
    arcpy.Merge_management(PointHelperTemp + ';' + ParcelPointHelper, PointsMerged)
    PointsMerged2 = """{}\\PhotoPoint""".format(Geodatabase)
    arcpy.Rename_management(PointsMerged, PointsMerged2)
    arcpy.EnableAttachments_management(PointsMerged2)
    arcpy.AddAttachments_management(PointsMerged2, "OBJECTID", PointsMerged2, "OBJECTID", "Path", "")

    shape = arcpy.Describe(PointsMerged2).ShapeFieldName
    fields = ['SHAPE@XY']
    edit = arcpy.da.Editor(Geodatabase)
    edit.startEditing(False, True)

    Coord = Location.split(' ')
    Coord2 = ",".join(Coord)
    with arcpy.da.UpdateCursor(PointsMerged2, "SHAPE@XY") as cur:
        for row in cur:
            row[0] = eval (Coord2)
            cur.updateRow(row)

    edit.stopEditing(True)

    arcpy.Delete_management(PointHelperTemp)
    arcpy.Delete_management(ParcelPointHelper)
    arcpy.Rename_management(PointsMerged2, ParcelPointHelper)
    arcpy.DeleteField_management(ParcelPointHelper, "Path")

else:
	pass





#______________________________________________________________________________#
#
# Cleanup Staging GeoDatabase
#______________________________________________________________________________#

if CameraInput == 'Associate Photo with Parcel':

	arcpy.Delete_management(PhotoFeatureClass2)
	arcpy.Delete_management(PhotoFeatureClass3)
	arcpy.Delete_management(ParcelsFeatureClass)
	arcpy.Delete_management(ParcelPointClassHelper)
	arcpy.DeleteField_management(ParcelPointHelper, "ORIG_FID")
	arcpy.DeleteField_management(ParcelPointHelper, "REVERSE_1")
	arcpy.DeleteField_management(ParcelPointHelper, "PATH2")
	arcpy.DeleteField_management(ParcelPointHelper, ParcelPIN + "_1")

	if ParcelPIN is "Name":
		arcpy.MakeFeatureLayer_management(ParcelPointHelper, "PARCELSFORSELECTION", "Image_Name is NULL")
	else:
		arcpy.MakeFeatureLayer_management(ParcelPointHelper, "PARCELSFORSELECTION", "Name is NULL")

	arcpy.DeleteRows_management("PARCELSFORSELECTION")
	arcpy.DeleteField_management(ParcelPointHelper, "Name")
	arcpy.AddMessage("Step 10: Cleaning up staging geodatabase")

	arcpy.AddMessage("Step 11: Adding application required fields")
	arcpy.AddField_management(ParcelPointHelper, "BSTPHOTOID", "TEXT", "", "", "25", "Best Photo Identifier", "NULLABLE", "NON_REQUIRED", "")
	arcpy.AddField_management(ParcelPointHelper, "SRVNAME", "TEXT", "", "", "25", "Surveyor Name", "NULLABLE", "NON_REQUIRED", "")
	arcpy.AddMessage("Step 12: Finalizing photo survey feature class")

else:
	pass

#______________________________________________________________________________#
#
# Add Template Table to Staging GeoDatabase
#______________________________________________________________________________#

arcpy.Copy_management(TemplateQTable,Geodatabase + "//SurveyQuestions")

if CameraInput == "Associate Photo with Parcel":
	arcpy.AddMessage("Step 13: Adding survey questions template table to staging geodatabase")
else:
	arcpy.AddMessage("Step 6: Adding survey questions template table to staging geodatabase")
