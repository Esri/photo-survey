import arcpy
import time
import requests
import json
from azure.cognitiveservices.vision.customvision.training import training_api
from azure.cognitiveservices.vision.customvision.training.models import ImageUrlCreateEntry

def imageListChunks(imgList,chunkSize):
    return [imgList[pos:pos + chunkSize] for pos in range(0, len(imgList), chunkSize)]
def imageList(tagName):
    url = "https://api.github.com/repos/esri/photo-survey/contents/Training%20Photos/{}?ref=image-recognition".format(tagName)
    response = requests.get(url)
    imgList = json.loads(response.text)
    if response.status_code == 200:
        return [img['download_url'] for img in imgList]
    else:
        sys.exit(1)

projectNames = ["Boarded", "Overgrowth", "Graffiti"]

training_key = arcpy.GetParameterAsText(0)

trainer = training_api.TrainingApi(training_key)

#Get Existing Project List from Azure:
existingProjects = [project.name for project in trainer.get_projects()]

# Create a new project
for name in projectNames:
    if name not in existingProjects:
        arcpy.AddMessage("Creating Model {}...".format(name))
        project = trainer.create_project(name)

        #Negative Tag Name
        negTagname = "Not_{}".format(name)

        #Make two tags in the new project
        positive_tag = trainer.create_tag(project.id, name)
        negative_tag = trainer.create_tag(project.id, negTagname)

        imageEntryList = [ImageUrlCreateEntry(image_url, [positive_tag.id]) for image_url in imageList(name)]
        negEntryList = [ImageUrlCreateEntry(image_url, [negative_tag.id]) for image_url in imageList(negTagname)]

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

        # The iteration is now trained. Make it the default project endpoint
        trainer.update_iteration(project.id, iteration.id, is_default=True)
        
        arcpy.AddMessage("Done!")
    else:
        arcpy.AddMessage("'{}' model already exists. Skipping...".format(name))
