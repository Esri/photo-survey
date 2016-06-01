"""
	@author: bus
	@contact: cbuscaglia@esri.com
	@company: Esri
	@version: 1.0.0
	@description: Photo Survey Tool to load photos
	@requirements: Python 2.7.x or higher, ArcGIS 10.2, 10.3.x, 10.4 (also ArcGIS Pro)
	@copyright: Esri, 2015

"""
# Import modules

import arcpy
import math
import ast
import sys, os, datetime
from os.path import dirname, join, exists, splitext, isfile
try:
	import ConfigParser
except ImportError:
	import configparser

arcpy.env.overwriteOutput = True

# Script arguments (set in the GP tool)

CameraInput = arcpy.GetParameterAsText(0)
SinglePhotos = arcpy.GetParameterAsText(1)
Location =  arcpy.GetParameterAsText(2)
PassengerPhotos = arcpy.GetParameterAsText(3)
DriverPhotos = arcpy.GetParameterAsText(4)
AngleField = arcpy.GetParameterAsText(5)
Geodatabase =  arcpy.GetParameterAsText(6)
Parcels = arcpy.GetParameterAsText(7)
ParcelPIN = arcpy.GetParameterAsText(8)
config_file = arcpy.GetParameterAsText(9)

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
	arcpy.CreateFeatureclass_management(Geodatabase, "PhotoPoints", "POINT", "", "", "", Parcels)
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
	arcpy.CreateFeatureclass_management(Geodatabase, "PhotoPoints", "Point", "", "DISABLED", "DISABLED",
										"GEOGCS['GCS_WGS_1984',DATUM['D_WGS_1984',SPHEROID['WGS_1984',6378137.0,298.257223563]],"
										"PRIMEM['Greenwich',0.0],UNIT['Degree',0.0174532925199433]],"
										"VERTCS['WGS_1984',DATUM['D_WGS_1984',SPHEROID['WGS_1984',6378137.0,298.257223563]],"
										"PARAMETER['Vertical_Shift',0.0],PARAMETER['Direction',1.0],"
										"UNIT['Meter',1.0]];-400 -400 1000000000;-100000 10000;-100000 10000;8.98315284119522E-09;0.001;0.001;"
										"IsHighPrecision", "", "0", "0", "0")
else:
	pass


if CameraInput == 'Associate Non-Geotagged Photo with specified Point (no location)':

	# ______________________________________________________________________________#
	#
	# Convert Photos to Pointsw/ no coordinates
	#_______________________________________________________________________________#

	ParcelPointHelper = """{}\\PhotoPoints""".format(Geodatabase)
	arcpy.CreateFeatureclass_management(Geodatabase, "PhotoPoints", "Point", "", "DISABLED", "DISABLED",
										"GEOGCS['GCS_WGS_1984',DATUM['D_WGS_1984',SPHEROID['WGS_1984',6378137.0,298.257223563]],"
										"PRIMEM['Greenwich',0.0],UNIT['Degree',0.0174532925199433]],"
										"VERTCS['WGS_1984',DATUM['D_WGS_1984',SPHEROID['WGS_1984',6378137.0,298.257223563]],"
										"PARAMETER['Vertical_Shift',0.0],PARAMETER['Direction',1.0],"
										"UNIT['Meter',1.0]];-400 -400 1000000000;-100000 10000;-100000 10000;8.98315284119522E-09;0.001;0.001;"
										"IsHighPrecision", "", "0", "0", "0")
else:
	pass


#______________________________________________________________________________#
#
# Adding Survey Fields
#______________________________________________________________________________#


DomGDB = arcpy.Describe(Geodatabase)
domains = DomGDB.Domains
dmCount = len(domains)
if dmCount > 0:
	for domain in domains:
		arcpy.DeleteDomain_management(Geodatabase, domain)
else:
	pass
if CameraInput == "Associate Photo with Parcel":
	arcpy.AddMessage("Step 8:  Adding survey questions")
else:
	arcpy.AddMessage("Step 2:  Adding Survey questions")

try:
	config = ConfigParser.ConfigParser()
except NameError:
	config = configparser.ConfigParser()

config.read(config_file)

Domain1 = config.get('DOMAINS', "Domain1")
Domain2 = config.get('DOMAINS', "Domain2")
Domain3 = config.get('DOMAINS', "Domain3")
Domain4 = config.get('DOMAINS', "Domain4")
Domain5 = config.get('DOMAINS', "Domain5")

if Domain1 == "":
	pass
else:
	arcpy.CreateDomain_management(Geodatabase, Domain1, Domain1, "TEXT", "CODED")
if Domain2 == "":
	pass
else:
	arcpy.CreateDomain_management(Geodatabase, Domain2, Domain2, "TEXT", "CODED")
if Domain3 == "":
	pass
else:
	arcpy.CreateDomain_management(Geodatabase, Domain3, Domain3, "TEXT", "CODED")
if Domain4 == "":
	pass
else:
	arcpy.CreateDomain_management(Geodatabase, Domain4, Domain4, "TEXT", "CODED")
if Domain5 == "":
	pass
else:
	arcpy.CreateDomain_management(Geodatabase, Domain5, Domain5, "TEXT", "CODED")

Domain1Values = config.get('DOMAIN_VALUES', "Domain1")
Domain2Values = config.get('DOMAIN_VALUES', "Domain2")
Domain3Values = config.get('DOMAIN_VALUES', "Domain3")
Domain4Values = config.get('DOMAIN_VALUES', "Domain4")
Domain5Values = config.get('DOMAIN_VALUES', "Domain5")

if Domain1Values == "":
	pass
else:
	DomainDict1 = ast.literal_eval(Domain1Values)
	for codex in DomainDict1:
		arcpy.AddCodedValueToDomain_management(Geodatabase, Domain1, codex, DomainDict1[codex])
if Domain2Values == "":
	pass
else:
	DomainDict2 = ast.literal_eval(Domain2Values)
	for codex in DomainDict2:
		arcpy.AddCodedValueToDomain_management(Geodatabase, Domain2, codex, DomainDict2[codex])
if Domain3Values == "":
	pass
else:
	DomainDict3 = ast.literal_eval(Domain3Values)
	for codex in DomainDict3:
		arcpy.AddCodedValueToDomain_management(Geodatabase, Domain3, codex, DomainDict3[codex])
if Domain4Values == "":
	pass
else:
	DomainDict4 = ast.literal_eval(Domain4Values)
	for codex in DomainDict4:
		arcpy.AddCodedValueToDomain_management(Geodatabase, Domain4, codex, DomainDict4[codex])
if Domain5Values == "":
	pass
else:
	DomainDict5 = ast.literal_eval(Domain5Values)
	for codex in DomainDict5:
		arcpy.AddCodedValueToDomain_management(Geodatabase, Domain5, codex, DomainDict5[codex])

Field1  = config.get('FIELDS', "Field1")
Field2  = config.get('FIELDS', "Field2")
Field3  = config.get('FIELDS', "Field3")
Field4  = config.get('FIELDS', "Field4")
Field5  = config.get('FIELDS', "Field5")
Field6  = config.get('FIELDS', "Field6")
Field7  = config.get('FIELDS', "Field7")
Field8  = config.get('FIELDS', "Field8")
Field9  = config.get('FIELDS', "Field9")
Field10 = config.get('FIELDS', "Field10")

Field1Alias = config.get('FIELDS_ALIAS', "Field1")
Field2Alias = config.get('FIELDS_ALIAS', "Field2")
Field3Alias = config.get('FIELDS_ALIAS', "Field3")
Field4Alias = config.get('FIELDS_ALIAS', "Field4")
Field5Alias = config.get('FIELDS_ALIAS', "Field5")
Field6Alias = config.get('FIELDS_ALIAS', "Field6")
Field7Alias = config.get('FIELDS_ALIAS', "Field7")
Field8Alias = config.get('FIELDS_ALIAS', "Field8")
Field9Alias = config.get('FIELDS_ALIAS', "Field9")
Field10Alias = config.get('FIELDS_ALIAS', "Field10")

ValueRequired1 = config.get('VALUE_REQUIRED', "Field1")
ValueRequired2 = config.get('VALUE_REQUIRED', "Field2")
ValueRequired3 = config.get('VALUE_REQUIRED', "Field3")
ValueRequired4 = config.get('VALUE_REQUIRED', "Field4")
ValueRequired5 = config.get('VALUE_REQUIRED', "Field5")
ValueRequired6 = config.get('VALUE_REQUIRED', "Field6")
ValueRequired7 = config.get('VALUE_REQUIRED', "Field7")
ValueRequired8 = config.get('VALUE_REQUIRED', "Field8")
ValueRequired9 = config.get('VALUE_REQUIRED', "Field9")
ValueRequired10 = config.get('VALUE_REQUIRED', "Field10")

DomainSet1 = config.get('FIELD_DOMAIN', "Field1")
DomainSet2 = config.get('FIELD_DOMAIN', "Field2")
DomainSet3 = config.get('FIELD_DOMAIN', "Field3")
DomainSet4 = config.get('FIELD_DOMAIN', "Field4")
DomainSet5 = config.get('FIELD_DOMAIN', "Field5")
DomainSet6 = config.get('FIELD_DOMAIN', "Field6")
DomainSet7 = config.get('FIELD_DOMAIN', "Field7")
DomainSet8 = config.get('FIELD_DOMAIN', "Field8")
DomainSet9 = config.get('FIELD_DOMAIN', "Field9")
DomainSet10 = config.get('FIELD_DOMAIN', "Field10")

if Field1 == "":
	pass
else:
	arcpy.AddField_management(ParcelPointHelper, Field1, "TEXT", "", "", "25", Field1Alias, ValueRequired1)

if DomainSet1 == "":
    pass
else:
	arcpy.AssignDomainToField_management(ParcelPointHelper, Field1, DomainSet1)

if Field2 == "":
	pass
else:
	arcpy.AddField_management(ParcelPointHelper, Field2, "TEXT", "", "", "25", Field2Alias, ValueRequired2)

if DomainSet2 == "":
    pass
else:
	arcpy.AssignDomainToField_management(ParcelPointHelper, Field2, DomainSet2)

if Field3 == "":
	pass
else:
	arcpy.AddField_management(ParcelPointHelper, Field3, "TEXT", "", "", "25", Field3Alias, ValueRequired3)

if DomainSet3 == "":
    pass
else:
	arcpy.AssignDomainToField_management(ParcelPointHelper, Field3, DomainSet3)

if Field4 == "":
	pass
else:
	arcpy.AddField_management(ParcelPointHelper, Field4, "TEXT", "", "", "25", Field4Alias, ValueRequired4)

if DomainSet4 == "":
    pass
else:
    arcpy.AssignDomainToField_management(ParcelPointHelper, Field4, DomainSet4)

if Field5 == "":
	pass
else:
	arcpy.AddField_management(ParcelPointHelper, Field5, "TEXT", "", "", "25", Field5Alias, ValueRequired5)

if DomainSet5 == "":
    pass
else:
	arcpy.AssignDomainToField_management(ParcelPointHelper, Field5, DomainSet5)

if Field6 == "":
	pass
else:
	arcpy.AddField_management(ParcelPointHelper, Field6, "TEXT", "", "", "25", Field6Alias, ValueRequired6)

if DomainSet6 == "":
    pass
else:
	arcpy.AssignDomainToField_management(ParcelPointHelper, Field6, DomainSet6)

if Field7 == "":
	pass
else:
	arcpy.AddField_management(ParcelPointHelper, Field7, "TEXT", "", "", "25", Field7Alias, ValueRequired7)

if DomainSet7 == "":
    pass
else:
	arcpy.AssignDomainToField_management(ParcelPointHelper, Field7, DomainSet7)

if Field8 == "":
	pass
else:
	arcpy.AddField_management(ParcelPointHelper, Field8, "TEXT", "", "", "25", Field8Alias, ValueRequired8)

if DomainSet8 == "":
    pass
else:
	arcpy.AssignDomainToField_management(ParcelPointHelper, Field8, DomainSet8)

if Field9 == "":
	pass
else:
	arcpy.AddField_management(ParcelPointHelper, Field9, "TEXT", "", "", "25", Field9Alias, ValueRequired9)

if DomainSet9 == "":
    pass
else:
	arcpy.AssignDomainToField_management(ParcelPointHelper, Field9, DomainSet9)

if Field10 == "":
	pass
else:
	arcpy.AddField_management(ParcelPointHelper, Field10, "TEXT", "", "", "25", Field10Alias, ValueRequired10)

if DomainSet10 == "":
    pass
else:
	arcpy.AssignDomainToField_management(ParcelPointHelper, Field10, DomainSet10)

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
    arcpy.AddField_management(ParcelPointHelper, "BSTPHOTOID", "TEXT", "", "", "5", "Best Photo Identifier", "NULLABLE", "NON_REQUIRED", "")
    arcpy.AddField_management(ParcelPointHelper, "SRVNAME", "TEXT", "", "", "25", "Surveyor Name", "NULLABLE", "NON_REQUIRED", "")
    arcpy.AddMessage("Step 4:  Finalizing photo survey feature class")
    arcpy.AddMessage("Step 5:  Creating Photo Attachments")
    ParcelPointHelperTemp = """{}\\ParcelPointsTemp""".format(Geodatabase)
    ParcelPointsMerged = """{}\\ParcelPointsMerged""".format(Geodatabase)
    arcpy.GeoTaggedPhotosToPoints_management(SinglePhotos, ParcelPointHelperTemp, "", "ONLY_GEOTAGGED", "NO_ATTACHMENTS")
    arcpy.Merge_management(ParcelPointHelperTemp + ';' + ParcelPointHelper, ParcelPointsMerged)
    arcpy.EnableAttachments_management(ParcelPointsMerged)
    arcpy.AddAttachments_management(ParcelPointsMerged, "OBJECTID", ParcelPointsMerged, "OBJECTID", "Path", "")
    arcpy.Delete_management(ParcelPointHelperTemp)
    arcpy.Delete_management(ParcelPointHelper)
    arcpy.Rename_management(ParcelPointsMerged, ParcelPointHelper)
    arcpy.DeleteField_management(ParcelPointHelper, "Path")
else:
	pass

if CameraInput == 'Associate Non-Geotagged Photo with specified Point (no location)':


    arcpy.AddMessage("Step 3:  Adding application required fields")
    arcpy.AddField_management(ParcelPointHelper, "BSTPHOTOID", "TEXT", "", "", "5", "Best Photo Identifier", "NULLABLE", "NON_REQUIRED", "")
    arcpy.AddField_management(ParcelPointHelper, "SRVNAME", "TEXT", "", "", "25", "Surveyor Name", "NULLABLE", "NON_REQUIRED", "")
    arcpy.AddMessage("Step 4:  Finalizing photo survey feature class")
    arcpy.AddMessage("Step 5:  Creating Photo Attachments")
    PointHelperTemp = """{}\\PointsTemp""".format(Geodatabase)
    PointsMerged = """{}\\PointsMerged""".format(Geodatabase)
    arcpy.GeoTaggedPhotosToPoints_management(SinglePhotos, PointHelperTemp, "", "ALL_PHOTOS", "NO_ATTACHMENTS")
    arcpy.Merge_management(PointHelperTemp + ';' + ParcelPointHelper, PointsMerged)
    arcpy.EnableAttachments_management(PointsMerged)
    arcpy.AddAttachments_management(PointsMerged, "OBJECTID", PointsMerged, "OBJECTID", "Path", "")

    shape = arcpy.Describe(PointsMerged).ShapeFieldName
    fields = ['SHAPE@XY']
    edit = arcpy.da.Editor(Geodatabase)
    edit.startEditing(False, True)

    Coord = Location.split(' ')
    Coord2 = ",".join(Coord)
    with arcpy.da.UpdateCursor(PointsMerged, "SHAPE@XY") as cur:
        for row in cur:
            row[0] = eval (Coord2)
            cur.updateRow(row)

    edit.stopEditing(True)

    arcpy.Delete_management(PointHelperTemp)
    arcpy.Delete_management(ParcelPointHelper)
    arcpy.Rename_management(PointsMerged, ParcelPointHelper)
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
	arcpy.AddField_management(ParcelPointHelper, "BSTPHOTOID", "TEXT", "", "", "5", "Best Photo Identifier", "NULLABLE", "NON_REQUIRED", "")
	arcpy.AddField_management(ParcelPointHelper, "SRVNAME", "TEXT", "", "", "25", "Surveyor Name", "NULLABLE", "NON_REQUIRED", "")
	arcpy.AddMessage("Step 12: Finalizing photo survey feature class")

else:
	pass



