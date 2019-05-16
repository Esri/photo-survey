from azure.cognitiveservices.vision.customvision.prediction import CustomVisionPredictionClient
from azure.cognitiveservices.vision.customvision.prediction import models
from azure.cognitiveservices.vision.customvision.training.models import ImageUrlCreateEntry
from azure.cognitiveservices.vision.customvision.training import CustomVisionTrainingClient
from arcgis.gis import GIS
from arcgis.features import FeatureLayer, Feature
import sys
import arcpy
import datetime as dt
import requests
import json
# TRAIN MODELS IF NEEDED*****************************************************************************************************

mode = arcpy.GetParameterInfo()[1].displayName
mode = bool("dev" in mode)

def imageListChunks(imgList,chunkSize):
    return [imgList[pos:pos + chunkSize] for pos in range(0, len(imgList), chunkSize)]

def imageList(tagName):
    errorMessage = "Error building image detection model. Unable to retrieve model training images."
    try:
        resolveShortlink = requests.get("http://links.esri.com/localgovernment/photosurvey/images")
        resolveUrl = resolveShortlink.url
        branch = "blight-images"
        if mode:
            branch = "blight-images-dev"
        else:
            branch = "blight-images"
        comm_url = "{}/{}?ref={}".format(resolveUrl,tagName, branch)
        response = requests.get(comm_url)
        #response = requests.get(comm_url, headers={"Authorization": "token putaccesstokenhere"})
        imgList = json.loads(response.text)
        if response.status_code == 200:
            return [img['download_url'] for img in imgList]
        else:
            arcpy.AddError(errorMessage)
            sys.exit(1)
    except Exception as e:
        arcpy.AddError(e.message)
        arcpy.AddError(errorMessage)
        sys.exit(1)



def checkValidProject(tr, prj):
    iterations = tr.get_iterations(prj.id)
    if len(iterations) == 1:
        if iterations[0].status == "New":
            return False
    if not iterations:
        return False
    return True

def getCurrentIteration(tr, prj):
    iterationList = [iteration for iteration in tr.get_iterations(prj.id) if iteration.publish_name]
    return sorted(iterationList, key=lambda itr: itr.trained_at, reverse=True)[0]


fcURL = arcpy.GetParameterAsText(0)
categories = arcpy.GetParameterAsText(1)
trainingkey = arcpy.GetParameterAsText(2)
predictionkey = arcpy.GetParameterAsText(3)
resource_id = arcpy.GetParameterAsText(4)
baseURL = arcpy.GetParameterAsText(5)

whereClause = "1=1"

trainer = CustomVisionTrainingClient(trainingkey, endpoint=baseURL)

categoryList = categories.split(";")

existingProjects = []

#Check existing projects for validity
for project in trainer.get_projects():
    if project.name in categoryList:
        if checkValidProject(trainer, project):
            # Valid project to do predictions with
            existingProjects.append(project.name)
        else:
            # Not a valid project because its either missing tags or hasn't been trained. Remove the model.
            arcpy.AddMessage("Invalid image detection model '{}' found. Rebuilding the model...".format(project.name))
            trainer.delete_project(project.id)

# Create a new project
for name in categoryList:
    #If the project already exists than no new models will be created
    if name not in existingProjects:
        arcpy.AddMessage("Creating Model {}...".format(name))
        project = trainer.create_project(name)

        #Negative Tag Name
        negTagname = "Not_{}".format(name)

        #Make two tags in the new project
        positive_tag = trainer.create_tag(project.id, name)
        negative_tag = trainer.create_tag(project.id, negTagname)

        imageEntryList = [ImageUrlCreateEntry(url=image_url, tag_ids=[positive_tag.id]) for image_url in imageList(name)]
        negEntryList = [ImageUrlCreateEntry(url=image_url, tag_ids=[negative_tag.id]) for image_url in imageList(negTagname)]

        arcpy.AddMessage("Loading training photos into model...")
        for imgChunk in imageListChunks(imageEntryList, 63):
            trainer.create_images_from_urls(project.id,imgChunk)
        for imgChunk in imageListChunks(negEntryList, 63):
            trainer.create_images_from_urls(project.id,imgChunk)
        arcpy.AddMessage("Training Model...")
        iteration = trainer.train_project(project.id)
        while iteration.status == "Training":
            iteration = trainer.get_iteration(project.id, iteration.id)
            time.sleep(3)

        iteration_name = name + "classifyModel"
        # The iteration is now trained. Make it the default project endpoint
        #trainer.update_iteration(project.id, iteration.id, is_default=True)
        trainer.publish_iteration(project.id,iteration.id,iteration_name, resource_id)
        
        arcpy.AddMessage("Done!")
    else:
        arcpy.AddMessage("Loading '{}' model for blight detection...".format(name))

# PREDICT PHOTO****************************************************************************************
if not fcURL.startswith('http'):
    desc = arcpy.Describe(fcURL)
    url = desc.path

    whereClause = desc.whereClause if desc.whereClause else "1=1" 

    try:
        layer_id = int(desc.name)
    except:
        name = desc.name[1:]
        layer_id = ''
        for c in name:
            if c in ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']:
                layer_id += c
            else:
                break
        layer_id = int(layer_id)
    fcURL = url + "/{}".format(str(layer_id))


target = GIS("pro")
feature_layer = FeatureLayer(fcURL, target)
flOID = arcpy.Describe(fcURL).OIDFieldName


#Add Probability Score Fields

AITagFields = {
    "fields": []
}

exFieldList = [field.name for field in feature_layer.properties.fields]


fieldAdd = False
for category in categoryList:
    fieldName = (category + "_prb").lower()
    if fieldName not in exFieldList:
        fieldAdd = True
        fieldInfo = {
            "name": fieldName,
            "type": "esriFieldTypeDouble",
            "alias": category + " Probability",
            "nullable": True,
            "editable": True
        }
        AITagFields['fields'].append(fieldInfo)

if fieldAdd:
    try:
        feature_layer.manager.add_to_definition(AITagFields)
        arcpy.AddMessage("Adding Probability Score Fields...")
    except:
        e = sys.exc_info()[1]
        arcpy.AddError(e)
        customMessage = """
        Error adding blight probability field, check to see that you have permissions on the Feature Service.\n
        Ensure that you input layer was added to the map through portal and that you are logged in to the
        organization that the hosted feature service belongs to.\n
        """
        arcpy.AddError(customMessage)
        sys.exit(1)

predictor = CustomVisionPredictionClient(predictionkey, endpoint=baseURL)

projectList = trainer.get_projects()

predictProjects = [{"projectID":project.id, "currentIteration":getCurrentIteration(trainer,project), "name":project.name} for project in projectList if project.name in categoryList]

arcpy.SetProgressorLabel("Gathering Attachment URLs from Service")

# Get Attachment URLS
results = feature_layer.attachments.search(where=whereClause)
tokenStr = "?token={}".format(target._con.token)
attachmentids = {}

for att in results:
    attachmentids[att['PARENTOBJECTID']] = []
for att in results:
    attachmentids[att['PARENTOBJECTID']].append(fcURL + "/{}/attachments/{}".format(att['PARENTOBJECTID'], att['ID']))

#Remove all attachments but the one in the middle of each house
for key, values in attachmentids.items():
    if values:
        midVal = values[int(len(values) / 2)]
        attachmentids[key] = midVal 

features = feature_layer.query(where=whereClause, return_geometry=False)
featuresDict = [feature for feature in features if feature.get_value(flOID) in attachmentids]
count = 0
arcpy.SetProgressor("step", "Analyzing Photos", 0, len(attachmentids) * len(predictProjects) ,1)
for key, value in sorted(attachmentids.items()):
    #url = feature_layer.url + '/{0}/attachments/{1}'.format(key, value)
    feature = featuresDict[count]
    count += 1
    for project in predictProjects:
        arcpy.SetProgressorLabel("Detecting Category '{}' in Feature {} of {}".format(project["name"],count,len(attachmentids)))
        results = predictor.classify_image_url_with_no_store(project["projectID"], project["currentIteration"].publish_name, url=value + tokenStr)
        for prediction in results.predictions:
            if prediction.tag_name in categoryList:
                feature.set_value(prediction.tag_name.lower() + "_prb", prediction.probability * 100)
        arcpy.SetProgressorPosition()

    feature_layer.edit_features(updates=[feature])

    


