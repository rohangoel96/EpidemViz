var fillInMissingDates = true;  //fill in missing dates in the data
var margin = {top: 0, right: 0, bottom: 20, left: 0}; //margin for timelines
var timeParseFormat = d3.time.format("%Y-%m-%d"); //time format in csv files
var timeDisplayFormat = d3.time.format("%d/%m/%y"); //time format to be displayed on screen
var divID1 = "#timeline-1"; //id of the div containing timeline 1
var divID2 = "#timeline-2"; //id of the div containing timeline 2
var timelineHeight = 90; //height of timeline div

var mapDataSelector = "OFFICIAL" //to decide data to be shown on map
var chartBoxWidth = 0; //the width of timeline without stretch
var timeStartDate = -1; //start date of data/timeline
var timeEndDate = -1; //end date of data/timeline
var width; //width of timeline including zoom
var trimStartDate = -1; //start date post trim
var trimEndDate = -1; //end date post trim
var heatMapEnableBool = false; //bool to toggle between HEATMAP/POINTS on map
var markers = new L.FeatureGroup(); //containes point markers for map
var heatMap = new L.FeatureGroup(); //contains heatmap for map
var markersArray = []; //contains markers (point) - used for lasso
var heatMapMarkers = []; //contains markers (heatmap) - used for lasso
var lasso = new FreeDraw({
    recreateAfterEdit: true,
    strokeWidth: 1,
    maximumPolygons : 1,
    leaveModeAfterCreate: true
}); //https://github.com/Wildhoney/Leaflet.FreeDraw
var lassoPolygon= null; //the lasso selection polygon
// var collapseTimelineNumber = 0; //number of timelines which are collapsed at the moment
var confidenceFilter = 0.2;
var dsv = d3.dsv(";", "text/plain"); //seperator in CSV = ;
var articleData;
var DHSOrder = "DHS";
var sunburstColorsCombined;
var NotChromeBrowser = false;
var ARTICLE_FILE = "/static/data/articles.csv"
var OFFICIAL_FILE = "/static/data/official.csv"
var UNOFFICIAL_FILE = "/static/data/un_official.csv"
var ARTICLE_FILE_NAME = "articles.csv"
var OFFICIAL_FILE_NAME = "official.csv"
var UNOFFICIAL_FILE_NAME = "un_official.csv"
/*
    Do the following when the page loads for the first time
 */
$(document).ready(function() {

    if(!(/chrom(e|ium)/.test(navigator.userAgent.toLowerCase()))){
        NotChromeBrowser = true;
        $(".data-file-icon").remove();
        window.alert("This app has been optimized for Google Chrome and we recommend using it!")
    }

    dsv(ARTICLE_FILE, function(error, data) {
        articleData = processedArticleData(data);
        plotter(true);
        map = L.map('map').setView([35, 10], 1);
        map.on('zoomend', mapZoomHandler)

        map.addLayer(lasso);
        lasso.mode(FreeDraw.NONE)
        lasso.on('markers', event => {
            var lassoPointListofList = event.latLngs;
            if(lassoPointListofList) {
                var lassoPolygonList = [];
                lassoPointListofList.forEach(function(polygonList) {
                    polygonList.forEach(function(latLng) {
                        lassoPolygonList.push([latLng.lat, latLng.lng]);
                    })
                    lassoPolygon = L.polygon(lassoPolygonList);
                    // lassoPolygon.addTo(map)
                    lassoHandler();
                })
            }
        });

        //match scrolls on both the div
        $(divID1).on('scroll', function () {$(divID2).scrollLeft($(this).scrollLeft());});
        $(divID2).on('scroll', function () {$(divID1).scrollLeft($(this).scrollLeft());});
        $("#icon-slider").popover();
        $("#icon-slider").on("click", function(){
            $($(".popover-title")[0]).html("Confidence Filter >= "+confidenceFilter);
            $("#pop-over-slider").val(confidenceFilter);
        })
    })

});


/*
    Handles the building of timeline and map
    and is triggered if there is any change in data
 */
function plotter(init=false) {
    $("#fileSelectModal").modal("hide")
    if(init){
    	$("#entity-species").empty()
		$("#entity-diseases").empty()
		$("#entity-symptoms").empty()
    }
    dsv(OFFICIAL_FILE, function(error, officialData) {
        if (error) throw error;
        dsv(UNOFFICIAL_FILE, function(error, unofficialData) {
            if (error) throw error;
            var dataType = $("input:radio[name=data-type]:checked").val();
            //calculate combined data first because active keys are calculated in processData for combined data
            //this is because entities should be populated from combined data
            var combinedData = officialData.concat(unofficialData); //combined official and unofficial data
            var processedCombinedData = processData(combinedData, dataType, init, true);
	        var processedOfficialData = processData(officialData, dataType, init);
            var processedUnofficialData = processData(unofficialData, dataType, init);
           	//hide the entity for the unselected data types
	        $(".entity-container").each(function(ind, div) {
	            $(div).css("display", ($(div).attr("id") == "entity-" + dataType? "block" : "none"));
	        })

            entityKeys = processedCombinedData[4]; //entity values should be decided from the combined data
            // colorrange = generateDistinctColors(entityKeys.length);
            // colorrange = colores_google(entityKeys.length); //colors for each of the entity

            chartBoxWidth = $(".panel-group").width() - margin.left - margin.right - 40;

            var sunburstData = {
                BOTH:processedCombinedData[5],
                OFFICIAL:processedOfficialData[5],
                UNOFFICIAL:processedUnofficialData[5]
            }

            if(init){
              sunburstColorsCombined = processedCombinedData[5][1]
            }
            
            //configuration object for the geographical map
            var mapConfig = {
                combinedData: processedCombinedData[0],
                officialData: processedOfficialData[0],
                unofficialData: processedUnofficialData[0],
                // colorrange: colorrange,
                entityKeys: entityKeys,
                sunburstData: sunburstData
            };

            //configuration object for the first timeline
            var timeline1Config = {
                divID: divID1,
                data: processedOfficialData[0],
                margin: margin,
                width: chartBoxWidth,
                height: timelineHeight - margin.top - margin.bottom,
                dataDateDict: processedOfficialData[2],
                dates : processedOfficialData[3],
                // colorrange: colorrange,
                entityKeys: entityKeys,
                dataDateDictHover: {
                    official: processedOfficialData[2],
                    unofficial: processedUnofficialData[2]
                },
                mapConfig: mapConfig,
                sunburstData: sunburstData
            };

            //configuration object for the second timeline
            var timeline2Config = {
                divID: divID2,
                data: processedUnofficialData[0],
                margin: margin,
                width: chartBoxWidth,
                height: timelineHeight - margin.top - margin.bottom,
                dataDateDict: processedUnofficialData[2],
                dates : processedUnofficialData[3],
                // colorrange: colorrange,
                entityKeys: entityKeys,
                dataDateDictHover: {
                    official: processedOfficialData[2],
                    unofficial: processedUnofficialData[2]
                },
                mapConfig: mapConfig,
                sunburstData: sunburstData
            };

            //handle selection of official/unofficial/both data on the geo map
            $(".data-file").change(function() {
                if($("#map-data-official").is(":checked") && $("#map-data-unofficial").is(":checked")) {
                    mapDataSelector = "BOTH";
                } else if ($("#map-data-official").is(":checked")){
                    mapDataSelector = "OFFICIAL";
                } else if ($("#map-data-unofficial").is(":checked")){
                    mapDataSelector = "UNOFFICIAL";
                } else {
                    mapDataSelector = "OFFICIAL";
                    $("#map-data-official").prop("checked", true);
                }
                geoMapHandler(mapConfig); //update map
                sunburstHandler(sunburstData);//updateSunburt
            });

            // //handle collapsing of both timelines
            // d3.select("#collapse-time-1").on("click", function() {
            //     handleTimelineCollapse(1, $("#collapse-time-1"), mapConfig);
            //     })
            // d3.select("#collapse-time-2").on("click", function() {
            //     handleTimelineCollapse(2, $("#collapse-time-2"), mapConfig);
            // })

            //handle collapsing of the left pane
            // d3.select("#collapse-left p").on("click", function() {
            //     if ($("#collapse-left p").html() == "Collapse") {
            //         $("#left-pane").css("display", "none");
            //         $("#collapse-left p").html("Expand");
            //         $("#right-pane").css("width", "1175px");
            //         timeline1Config.width = $("#timeline-1").width() - margin.left - margin.right;
            //         timeline2Config.width = $("#timeline-1").width() - margin.left - margin.right;
            //         drawTimeline(timeline1Config);
            //         drawTimeline(timeline2Config);
            //     } else {
            //         $("#left-pane").css("display", "block");
            //         $("#collapse-left p").html("Collapse");
            //         $("#right-pane").css("width", "975px");
            //         timeline1Config.width = $("#timeline-1").width() - margin.left - margin.right;
            //         timeline2Config.width = $("#timeline-1").width() - margin.left - margin.right;
            //         drawTimeline(timeline1Config);
            //         drawTimeline(timeline2Config);
            //     }
            // })
            //update colors for entities in the left pane
            $(".enties-label").css("color", "black")
            $( "label[id^='label_"+$("input:radio[name=data-type]:checked").val()+"']").each(function(ind, item) {
                $(this).css("color", sunburstColorsCombined[$(this).attr("id").split("_")[2].replace(new RegExp('-', 'g'), "_")]);
            })

            var sortable = Sortable.create(document.getElementById('items'), {
                onUpdate: function (/**Event*/evt) {
                    var newOrder = evt.to.children
                    DHSOrder = $($($(newOrder[0]).children(":first")[0])[0]).text()[0] + $($($(newOrder[1]).children(":first")[0])[0]).text()[0] + $($($(newOrder[2]).children(":first")[0])[0]).text()[0];
                    sunburstHandler(sunburstData);
                },
            });

            drawTimeline(timeline1Config); //draw the timeline 1
            drawTimeline(timeline2Config); //draw the timeline 2
            if (trimStartDate!= -1 || trimEndDate!=-1){
                geoMapHandler(mapConfig, true); //draw the map
                sunburstHandler(sunburstData, true);
                timelineUpdateWithZoom(timeline1Config)
                timelineUpdateWithZoom(timeline2Config)
            } else {
                geoMapHandler(mapConfig, false); //draw the map
                sunburstHandler(sunburstData, false);
            }

            $(".se-pre-con").fadeOut("slow");; //preloader
        });
    });

}


/**
 * Handles the drawing and update of the geographical map
 * @param  {object} mapConfig configuration object for the map
 * @param  {Boolean} trimmingBool to enable/disable trimming effects on the map
 */
function geoMapHandler(mapConfig, trimmingBool=true) {
    var entityKeys = mapConfig.entityKeys;
    var sunburstData = mapConfig.sunburstData;
    var data, startDate, endDate;
    $("#current-slider-val").text(confidenceFilter)
    //select which data to display on map
    if (mapDataSelector == "OFFICIAL") {
        data = mapConfig.officialData;
    } else if (mapDataSelector == "UNOFFICIAL"){
        data = mapConfig.unofficialData;
    } else {
        data = mapConfig.combinedData;
    }

    //clear variables before drawing the map
    markers.clearLayers();
    heatMap.clearLayers();
    markersArray = [];
    heatMapMarkers = [];
    // L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
     L.tileLayer('https://api.tiles.mapbox.com/v4/mapbox.run-bike-hike/{z}/{x}/{y}.png?access_token=pk.eyJ1Ijoicm9oYW5nb2VsOTYiLCJhIjoiY2phbDloNWtpM253ODJ3bG9mNWdiYzQwMiJ9.jZJvg-axeL9dDxyvGVGfkQ', {
        // attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
        noWrap: true,
        maxZoom: 8,
        minZoom: 1,
    }).addTo(map);

    //if trimming has been done select trimming dates as start and end date
    if(trimmingBool){
        startDate = new Date(trimStartDate);
        endDate = new Date(trimEndDate);
        if (trimStartDate == -1) startDate = new Date(timeStartDate);
        if (trimEndDate == -1) endDate = new Date(timeEndDate);

    } else {
        startDate = new Date(timeStartDate);
        endDate = new Date(timeEndDate);
    }
    
    //if heatmap is selected
    if (heatMapEnableBool) {
        var dataLocationDict = {};
        var heatmapLocationData = [];
        var maxDataLocationCount = -1;
        data.forEach(function(item){
            if (item.date >= startDate && item.date <= endDate && item.location.length > 0) {
                item.location.forEach(function(location, ind) {
                    if(parseFloat(item.confidence[ind]) >= confidenceFilter){
                        heatMapMarkers.push({
                            marker: L.circle(location, {}),
                            date: item.date,
                            reliability: item.reliability
                        });
                        //calculate the number of items at one location because heatmap neads intensity
                        var dataLocString = coordinateTupleToString(location);
                        if (dataLocString in dataLocationDict) {
                            dataLocationDict[dataLocString] += 1
                            maxDataLocationCount = Math.max(maxDataLocationCount, dataLocationDict[dataLocString]);
                        } else {
                            dataLocationDict[dataLocString] = 1;
                        }
                    }
                })
            }
        })
        for (dataLocString in dataLocationDict){
            var dataLocationTuple = stringToCoordinateTuple(dataLocString);
            heatmapLocationData.push([dataLocationTuple[0], dataLocationTuple[1], dataLocationDict[dataLocString]/maxDataLocationCount]);
        }
        var heat = L.heatLayer(heatmapLocationData, {
            radius: 8,
            minOpacity: 0.35,
            maxZoom: 5,
            blur: 7,
            max: 1,
            gradient: {0.1:"#4B0082", 0.25: '#0000FF', 0.4: "#00FF00", 0.6:"#FFCC00", 0.7: '#FF7F00', 0.9: "#FF0000"},
        }) // https://github.com/Leaflet/Leaflet.heat
        heatMap.addLayer(heat)
        map.addLayer(heatMap)
    } else {
        //if the pointers are selected
        data.forEach(function(item){
            if (item.date >= startDate && item.date <= endDate && item.location.length > 0) {
                item.location.forEach(function(location, ind) {
                    if (!(item.reliability[ind] == "official" || item.reliability[ind] == "unofficial")) {
                        console.log("ERROR: RELIABILITY NOT FOUND", item.reliability[ind]);
                        throw "RELIABILITY ERROR - DATASET FOUND WITH UNEXPECTED RELIABILITY"
                    }
                    if(parseFloat(item.confidence[ind]) >= confidenceFilter){
                        var article = articleData[item.article[ind]]
                        var circle = L.shapeMarker(location, {  // https://github.com/rowanwins/Leaflet.SvgShapeMarkers
                            shape: NotChromeBrowser ? "circle" : (item.reliability[ind] == "official" ? "circle" : "diamond"), //select shape accordingly
                            color: sunburstColorsCombined[item.key.replace(new RegExp('-', 'g'), "_")],
                            fill: sunburstColorsCombined[item.key.replace(new RegExp('-', 'g'), "_")],
                            radius: giveRadiusForMarkersZoom(),
                            weight: 1
                        })
                        // .bindPopup("<a href='javascript:void(0);' onclick='markerModalHandler(\""+item.article[ind]+"\");return false;'>View <i class='icon-article'></i></a> ; "+"Date: "+timeDisplayFormat(item.date)+" ; Conf.: "+parseFloat(item.confidence[ind]).toFixed(2));
                        markers.addLayer(circle);
                        markersArray.push({
                            marker: circle,
                            date: item.date,
                            key: item.key,
                            reliability: item.reliability[ind]//reliability = official/unoffical
                        })
                    }
                })
            }
        })

        if(map.hasLayer(markers)){
            map.removeLayer(markers)
        }
        map.addLayer(markers);
        
        map.on('click', function(e) {
            var popupText = ""
            var popLocation= e.latlng;
            data.forEach(function(item){
                if (item.date >= startDate && item.date <= endDate && item.location.length > 0) {
                    item.location.forEach(function(location, ind) {
                        if(parseFloat(item.confidence[ind]) >= confidenceFilter && getDistanceFromLatLonInKm(location, popLocation) < getPopUpTriggerDistance() && (item.reliability[ind] == mapDataSelector.toLowerCase() || mapDataSelector == "BOTH")){
                           var iconShape = '<i class="icon-'+(NotChromeBrowser ? "circle" : (item.reliability[ind] == "official" ? "circle" : "rhombus"))+'"></i>'
                           popupText += "<span style='color:"+sunburstColorsCombined[item.key.replace(new RegExp('-', 'g'), "_")]+"'>"+iconShape+"</span> "+"Date: "+timeDisplayFormat(item.date)+" ; Conf.: "+parseFloat(item.confidence[ind]).toFixed(2)+" ; <a href='javascript:void(0);' onclick='markerModalHandler(\""+item.article[ind]+"\");return false;'>View <i class='icon-article'></i></a><br>"
                        }
                    })
                }
            })
            if(popupText.length > 0){
                var popup = L.popup()
                    .setLatLng(popLocation)
                    .setContent(popupText)
                    .openOn(map);   
            }
        });
    }
    map.closePopup();
    lassoResetHandler();
}


function processedArticleData(data){
    var articleDataDict = {}
    if(data){
        data.forEach(function(tuple){
            articleDataDict[tuple["id"]] = tuple
        })
    }
    return articleDataDict
}



/**
 * @param  {data} array
 * @param  {dataType} string
 */
function processData(data, dataType, init, combinedDataBool=false) {
    var species_host = [],
        diseases = [],
        symptoms = []
        dates = [],
        dataDateDict ={}, 
        activeKeys = [],
        allKeys = [];
    
    data.map(function(d) {
            species_host = species_host.concat(d.species.split(','));
            diseases = diseases.concat(d.diseases.split(','));
            symptoms = symptoms.concat(d.symptoms.split(','));
            dates.push(d.publication_date);
    });

    var sunburstDict = {
        "DHS": {},
        "DSH": {},
        "HDS": {},
        "HSD": {},
        "SDH": {},
        "SHD": {}
    }, sunburstUniqueItems = [], uniq_disease = [], uniq_host = [], uniq_symptoms = [];

    
    if(init && combinedDataBool){
    	appendEntities("#entity-species", species_host, 'species_');
    	appendEntities("#entity-diseases", diseases, 'diseases_');
    	appendEntities("#entity-symptoms", symptoms, 'symptoms_');
    }


    // default selection
    $('input[id^="disease"]').attr('checked', true);

    dates = _.uniq(dates);
    activeKeys = [];
    var noEntitySelected = false;
    //check if no entity selected => select all
    if (($('input[id^="'+dataType+'"]:checked')).length === 0) {noEntitySelected = true;}
    
    //disable selecting entities of other data-types
    $('.entities-checkbox').each(function() {
        if (dataType != this.value.split("_")[0]) {
            $(this).prop("disabled", true);
            $(this).prop("checked", false);
        } else {
            $(this).prop("disabled", false);
            if (noEntitySelected){
                $(this).prop("checked", true);
            }
        }
    })

    //calculate the active activeKeys
    objList =  $('input[id^="'+dataType+'"]')    
    for (var i = objList.length - 1; i >= 0; i--) {
        if($(objList[i]).is(":checked")){
            activeKeys.push(objList[i].name.split(""+dataType+"_")[1]);
        }
        allKeys.push(objList[i].name.split(""+dataType+"_")[1])
    }
    
    if (fillInMissingDates){
        // calculate the minimum and the maximum dates
        // and then calculate and fill in the missing dates in between
        var minDate = new Date(dates.reduce(function (a, b) { return a < b ? a : b; }));
        var maxDate = new Date(dates.reduce(function (a, b) { return a > b ? a : b; }));
        
        //helper function for getDates()
        Date.prototype.addDays = function(days) {
            var dat = new Date(this.valueOf());
            dat.setDate(dat.getDate() + days);
            return dat;
        }

        //returns a list of dates between 2 dates
        function getDates(startDate, stopDate) {
            var localDateArray = new Array();
            var currentDate = startDate;
            localDateArray.push(dateObjectToString(new Date (currentDate)));
            while (currentDate <= stopDate) {
                currentDate = currentDate.addDays(1);
                localDateArray.push(dateObjectToString(new Date (currentDate)));
            }
            return localDateArray;
        }

        dates = getDates(minDate, maxDate);        
    } else {
        function dateSorter (a,b){
        // Turn your strings into dates, and then subtract them
        // to get a value that is either negative, positive, or zero.
            return new Date(a) - new Date(b);
        };
        dates.sort(dateSorter);
    }

    timeStartDate = dates[0];
    timeEndDate = dates[dates.length - 1];

    dates.forEach(function(date) {
        dataDateDict[date] = {};
        activeKeys.forEach(function(key) {
            //default each value to zero
            dataDateDict[date][key] = {};
            dataDateDict[date][key]["value"] = 0;
            dataDateDict[date][key]["location"] = [];
            dataDateDict[date][key]["confidence"] = [];
            dataDateDict[date][key]["reliability"] = [];
            dataDateDict[date][key]["article"] = [];
        })
    })

    data.map(function(d) {
         d["diseases"].split(',').filter(function(entry) { return entry.trim() != ''; }).forEach(function(_disease){
            d["species"].split(',').filter(function(entry) { return entry.trim() != ''; }).forEach(function(_host){
                d["symptoms"].split(',').filter(function(entry) { return entry.trim() != ''; }).forEach(function(_symptom){
                    var disabledKeys = allKeys.filter(function(x) { return activeKeys.indexOf(x) < 0 })
                    if(!(disabledKeys.indexOf(_disease)>-1 || disabledKeys.indexOf(_host)>-1 ||disabledKeys.indexOf(_symptom)>-1)){
                        var disease = _disease.replace(new RegExp('-', 'g'), "_");
                        var host = _host.replace(new RegExp('-', 'g'), "_");
                        var symptom = _symptom.replace(new RegExp('-', 'g'), "_");
                        
                        var dhskey = disease+"-"+host+"-"+symptom;
                        var dshkey = disease+"-"+symptom+"-"+host;
                        var hdskey = host+"-"+disease+"-"+symptom;
                        var hsdkey = host+"-"+symptom+"-"+disease;
                        var sdhkey = symptom+"-"+disease+"-"+host;
                        var shdkey = symptom+"-"+host+"-"+disease;

                        if(dhskey in sunburstDict["DHS"]){
                            sunburstDict["DHS"][dhskey].push(d.publication_date)
                            sunburstDict["DSH"][dshkey].push(d.publication_date)
                            sunburstDict["HDS"][hdskey].push(d.publication_date)
                            sunburstDict["HSD"][hsdkey].push(d.publication_date)
                            sunburstDict["SDH"][sdhkey].push(d.publication_date)
                            sunburstDict["SHD"][shdkey].push(d.publication_date)
                        } else {
                            sunburstDict["DHS"][dhskey] = [d.publication_date]
                            sunburstDict["DSH"][dshkey] = [d.publication_date]
                            sunburstDict["HDS"][hdskey] = [d.publication_date]
                            sunburstDict["HSD"][hsdkey] = [d.publication_date]
                            sunburstDict["SDH"][sdhkey] = [d.publication_date]
                            sunburstDict["SHD"][shdkey] = [d.publication_date]
                        }
                        uniq_disease.push(disease)
                        uniq_symptoms.push(symptom)
                        uniq_host.push(host)
                    }                    
                })
            })
        })

        d[dataType].split(',').forEach(function(key) {
            if (activeKeys.indexOf(key) > -1) {
                //fill in the value
                dataDateDict[d.publication_date][key]["value"] += 1;
                dataDateDict[d.publication_date][key]["location"].push([d.latitude, d.longitude]);
                dataDateDict[d.publication_date][key]["confidence"].push(d.confidence);
                dataDateDict[d.publication_date][key]["reliability"].push(d.rss_feed_reliability);
                dataDateDict[d.publication_date][key]["article"].push(d.article);
            }
        });
    })

    sunburstUniqueItems = _.uniq(uniq_disease).concat(_.uniq(uniq_host)).concat(_.uniq(uniq_symptoms))
    dataList = [];
    //add data in a sequence of dates
    for (date in dataDateDict) {
        for (key in dataDateDict[date]){
            var tuple = {
                "date": timeParseFormat.parse(date),
                "key": key,
                "value": +dataDateDict[date][key]["value"],
                "location": dataDateDict[date][key]["location"],
                "confidence": dataDateDict[date][key]["confidence"],
                "reliability": dataDateDict[date][key]["reliability"],
                "article": dataDateDict[date][key]["article"]
            };
            dataList.push(tuple);
        }
    } 

    sunburstColors = {}
    var colorList = sunburst_colors(sunburstUniqueItems.length)
    for (var i = sunburstUniqueItems.length - 1; i >= 0; i--) {
        sunburstColors[sunburstUniqueItems[i]]=colorList[i]
    }

    return [dataList, activeKeys, dataDateDict, dates, allKeys, [sunburstDict, sunburstColors]];
}


/**
 * @param  {list} coordinate 2D array for a location coordinate
 * @return {string} string representation of coordinate to be used as a key
 */
function coordinateTupleToString(coordiante){
    return ""+coordiante[0]+"_"+coordiante[1];
}


/**
 * @param  {string} str string representation of coordinate used as a key
 * @return {list} 2D array for a location coordinate
 */
function stringToCoordinateTuple(str){
    var tup = str.split("_");
    return [parseFloat(tup[0]), parseFloat(tup[1])];
}


/**
 * @param  {string} containerID ID for the container where to append the items
 * @param  {list} list of items to append
 * @param  {string} what ID to prepend to the items
 * helper function to append entities into the left-pane
 */
function appendEntities(containerID, objList, idText) {
    if(!($(containerID).find('input').length > 0)) {
        _.uniq(objList.filter(function(entry) { return entry.trim() != ''; })).forEach(function(item) {
                $(containerID).append(
                        $(document.createElement('label')).text(trimTextToFitOnScreen(item, 20))
                        .attr({
                            class: "enties-label",
                            id: "label_"+idText + item
                        })
                        .append(
                                $(document.createElement('input')).attr({
                                        id:    idText + item,
                                        name:  idText + item,
                                        value: idText + item,
                                        class: 'entities-checkbox',
                                        type:  'checkbox',
                                        onclick: 'plotter()'
                                })
                        )  
                );
        })
    }
}


/**
 * @param  {object} config object for the timeline drawing
 * Handles the drawing of the flowcharts
 */
function drawTimeline(config) {
    var margin = config.margin;
    width = config.width;
    var height = config.height;
    var data = config.data;
    var sunburstData = config.sunburstData;
    var divID = config.divID;
    var datearray = [];

    strokecolor = "#aaa"; //stroke color for the flows

    //tooltips when hover over the flows
    var tooltip1 = d3.select("body")
        .append("div")
        .attr("class", "remove tooltips")
        .attr("id", "tooltip1")
        .style("z-index", "20")
        .style("visibility", "hidden")
    
    var tooltip2 = d3.select("body")
        .append("div")
        .attr("class", "remove tooltips")
        .attr("id", "tooltip2")
        .style("z-index", "20")
        .style("visibility", "hidden")

    var x = d3.time.scale()
            .domain([new Date(timeStartDate), new Date(timeEndDate)])   
            .range([0, width]);

    var y = d3.scale.linear()
            .range([height-10, 0]);

    var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom")
            .tickFormat(timeDisplayFormat)
            .ticks(config.width/25)

    var stack = d3.layout.stack()
            .offset("silhouette")
            .values(function(d) { return d.values; })
            .x(function(d) { return d.date; })
            .y(function(d) { return d.value; });

    var nest = d3.nest()
            .key(function(d) { return d.key; });

    var area = d3.svg.area()
            .interpolate("basis")
            .x(function(d) { return x(d.date); })
            .y0(function(d) { return y(d.y0); })
            .y1(function(d) { return y(d.y0 + d.y); });

    d3.select(divID+" svg").remove();
    var svg = d3.select(divID).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var layers = stack(nest.entries(data));

    // x.domain(d3.extent(data, function(d) { return d.date; }));
    x.domain([new Date(timeStartDate), new Date(timeEndDate)]);
    y.domain([0, d3.max(data, function(d) { return d.y0 + d.y; })]);

    svg.selectAll(".layer")
        .data(layers)
        .enter().append("path")
        .attr("class", "layer")
        .attr("d", function(d) { return area(d.values); })
        .style("fill", function(d, i) {return sunburstColorsCombined[d.key.replace(new RegExp('-', 'g'), "_")]; });

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    svg.selectAll(".tick text").each(function(d, i) {
        if (i%4 != 0){
            $(this).hide()
        }
    });

    svg.selectAll(".tick line").each(function(d, i) {
        if (i%2 != 0){
            $(this).attr("y2", "5")
        }
    });

    var streamValue1 = 0, streamValue2 = 0;
    //vertical line to see data on the dates
    var verticalHover = d3.select(divID1+" svg").append("line")
        .attr("class", "verticalHover")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", config.height)
        .style("stroke-width", 3)
        .style("stroke-dasharray", ("5, 8"))
        .style("stroke", "#aaa")
        .style("fill", "none")
        .attr("opacity", 0)
        .attr("id", "vertical-hover-1")

    var verticalHover2 = d3.select(divID2+" svg").append("line")
        .attr("class", "verticalHover")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", config.height)
        .style("stroke-width", 3)
        .style("stroke-dasharray", ("5, 8"))
        .style("stroke", "#aaa")
        .style("fill", "none")
        .attr("opacity", 0)
        .attr("id", "vertical-hover-2")

    svg.selectAll(".layer")
        .attr("opacity", 1)
        .on("mouseover", function(d, i) {
            if(!clickedOnSurburst){
                d3.selectAll(".chart").selectAll(".layer").transition()
                .duration(250)
                .attr("opacity", function(d, j) {
                    return j != i ? 0.25 : 1; //fade the non-hovered flows
                })
            }
        })
        .on("mousemove", function(d, i) {
            mouse = d3.mouse(this);
            mousex = mouse[0],
            mousey = mouse[1];
            //calculate the nearest mouse date to the mouse and show verticcal hver there
            var mouseDate = dateObjectToString(x.invert(d3.mouse(this)[0]));
            var nearestMouseDate = giveNearestDate(mouseDate, config.dates)

            streamValue1 = 0, streamValue2 = 0;
            if(config.dataDateDictHover["official"][nearestMouseDate]){
                streamValue1 = config.dataDateDictHover["official"][nearestMouseDate][d.key].value
            }

            if(config.dataDateDictHover["unofficial"][nearestMouseDate]){
                streamValue2 = config.dataDateDictHover["unofficial"][nearestMouseDate][d.key].value
            }
            
            var dateToXScale = d3.time.scale()
                .domain([new Date(timeStartDate), new Date(timeEndDate)])
                .range([0, width]);

            d3.select(this)
                .classed("hover", true)
                .attr("stroke", strokecolor)
                .attr("stroke-width", "0.5px"); 

            d3.selectAll(".verticalHover")
                .attr("x1", dateToXScale(new Date(nearestMouseDate)))
                .attr("x2", dateToXScale(new Date(nearestMouseDate)))
                .attr("opacity", "1");

            tooltip1.html( "<p style='font-size: 10px;'>" + d.key + ": <b>" + streamValue1 + "</b><br><span style='font-size: 9px; position: relative; top: -3px;'>" + timeDisplayFormat(new Date(nearestMouseDate)) + "</span></p>" ).style("visibility", "visible")
                .style("left", ($(divID1).offset().left + parseFloat($("#vertical-hover-1")[0].getBBox().x) - $(divID1).scrollLeft() + 10) +"px")
                .style("top", ($(divID1).offset().top + mousey - 25) +"px");

            tooltip2.html( "<p style='font-size: 10px;'>" + d.key + ": <b>" + streamValue2 + "</b><br><span style='font-size: 9px; position: relative; top: -3px;'>" + timeDisplayFormat(new Date(nearestMouseDate)) + "</span></p>" ).style("visibility", "visible")
                .style("left", (($(divID1).offset().left + parseFloat($("#vertical-hover-2")[0].getBBox().x) - $(divID2).scrollLeft() + 10)) +"px")
                .style("top", ($(divID2).offset().top + mousey - 25) +"px");
        })
        .on("mouseout", function(d, i) {
            if(!clickedOnSurburst){
                d3.selectAll(".chart").selectAll(".layer")
                .transition()
                .duration(250)
                .attr("opacity", "1"); 
            }

            tooltip1.html( "<p>" + d.key + "<br>" + streamValue1 + "</p>" ).style("visibility", "hidden");
            tooltip2.html( "<p>" + d.key + "<br>" + streamValue2 + "</p>" ).style("visibility", "hidden");
            
            d3.selectAll(".verticalHover").attr("opacity", "0");
        })

    //drag white rectanges fade the timeline when trimming
    var dragWhiteRect1 = d3.select(divID+" svg").append("rect")
          .attr("x", 0)
          .attr("y", margin.top)
          .attr("width", 0)
          .attr("height", config.height)
          .attr("opacity", 0.3)
          .attr("fill", "white")
          .attr("class", "drag-white-rect dragWhiteRectStart")

    var dragWhiteRect2 = d3.select(divID+" svg").append("rect")
          .attr("x", width)
          .attr("y", margin.top)
          .attr("width", 0)
          .attr("height", config.height)
          .attr("opacity", 0.3)
          .attr("fill", "white")
          .attr("class", "drag-white-rect dragWhiteRectEnd")

    //handles start trimmer
    var drag1 = d3.behavior.drag()
           .on('dragstart', null)
           .on('drag', function(d){
                var dx = d3.event.dx;
                var x1New = parseFloat(d3.select(this).attr('x1'))+ dx;
                var x2New = parseFloat(d3.select(this).attr('x2'))+ dx;
                if(x1New + 0.1*width < parseFloat(verticalDateEnd.attr('x1')) && x1New > 2){
                    d3.selectAll(".verticalDateStart").attr("x1", x1New).attr("x2", x2New)
                    d3.selectAll(".dragWhiteRectStart").attr("width", x1New - 2)
                        .attr("opacity", 0.3)
                }
                d3.selectAll(".dragArrow").attr("visibility", "hidden")
                d3.selectAll(".verticalHover").attr("visibility", "hidden")
                d3.selectAll(".tooltips").style("display", "none")
             }).on('dragend', function(d){
                var mouseDate = dateObjectToString(x.invert(parseFloat(d3.select(this).attr('x1'))));
                trimStartDate = mouseDate;
                geoMapHandler(config.mapConfig)
                sunburstHandler(config.sunburstData)
                dragWhiteRect1.attr("opacity", 0.6)
                if (parseFloat(verticalDateEnd.attr("x1")) - parseFloat(verticalDateStart.attr("x1")) < 0.9*width) {
                    var newArrowX = (parseFloat(verticalDateStart.attr("x1")) + parseFloat(verticalDateEnd.attr("x1")))/2
                    d3.selectAll(".dragArrow").attr("visibility", "visibile").attr("x1", newArrowX-20).attr("x2", newArrowX+20)
                }
                d3.selectAll(".verticalHover").attr("visibility", "visible")
                d3.selectAll(".tooltips").style("display", "block")
             }); 
    
    //handles end trimmer
    var drag2 = d3.behavior.drag()
       .on('dragstart', null)
       .on('drag', function(d){
            var dx = d3.event.dx;
            var x1New = parseFloat(d3.select(this).attr('x1'))+ dx;
            var x2New = parseFloat(d3.select(this).attr('x2'))+ dx;
            if(x1New > parseFloat(verticalDateStart.attr('x1')) + 0.1*width && x1New < width - 2){
                d3.selectAll(".verticalDateEnd").attr("x1", x1New).attr("x2", x2New)
                d3.selectAll(".dragWhiteRectEnd").attr("width", width - x2New)
                        .attr("x", x2New + 2)
                        .attr("opacity", 0.3)
            }
            d3.selectAll(".dragArrow").attr("visibility", "hidden")
            d3.selectAll(".verticalHover").attr("visibility", "hidden")
            d3.selectAll(".tooltips").style("display", "none")
         }).on('dragend', function(d) {
            var mouseDate = dateObjectToString(x.invert(parseFloat(d3.select(this).attr('x1'))));
            trimEndDate = mouseDate;
            geoMapHandler(config.mapConfig);
            sunburstHandler(config.sunburstData);
            dragWhiteRect2.attr("opacity", 0.6)
            if (parseFloat(verticalDateEnd.attr("x1")) - parseFloat(verticalDateStart.attr("x1")) < 0.9*width) {
                var newArrowX = (parseFloat(verticalDateStart.attr("x1")) + parseFloat(verticalDateEnd.attr("x1")))/2
                d3.selectAll(".dragArrow").attr("visibility", "visibile").attr("x1", newArrowX-20).attr("x2", newArrowX+20)
            }
            d3.selectAll(".verticalHover").attr("visibility", "visible")
            d3.selectAll(".tooltips").style("display", "block")
         });

    //handler drag arrow
    var drag3 = d3.behavior.drag()
        .on('dragstart', null)
        .on('drag', function(d){
            var dx = d3.event.dx;
            var dragStartNew = parseFloat(verticalDateStart.attr('x1')) + dx
            var dragRectEndNew = parseFloat(verticalDateEnd.attr('x1')) + dx
            var dragArrowNew = parseFloat(dragArrow.attr('x1')) + dx
            if (dragStartNew > 2 && dragRectEndNew < width-2) {
                d3.selectAll(".dragArrow").attr('x1', dragArrowNew).attr("x2", dragArrowNew + 40)
                d3.selectAll(".verticalDateStart").attr("x1", dragStartNew).attr("x2", dragStartNew);
                d3.selectAll(".verticalDateEnd").attr("x1", dragRectEndNew).attr("x2", dragRectEndNew);
                d3.selectAll(".dragWhiteRectStart").attr("width", dragStartNew - 2)
                        .attr("opacity", 0.3)
                d3.selectAll(".dragWhiteRectEnd").attr("width", width - dragRectEndNew)
                        .attr("x", dragRectEndNew + 2)
                        .attr("opacity", 0.3)
            }
            d3.selectAll(".verticalHover").attr("visibility", "hidden")
            d3.selectAll(".tooltips").style("display", "none")
        }).on('dragend', function(d) {
            d3.selectAll(".dragWhiteRectStart").attr("opacity", 0.6)
            d3.selectAll(".dragWhiteRectEnd").attr("opacity", 0.6)
            trimStartDate = dateObjectToString(x.invert(parseFloat(verticalDateStart.attr('x1'))));
            trimEndDate = dateObjectToString(x.invert(parseFloat(verticalDateEnd.attr('x1'))));
            d3.selectAll(".verticalHover").attr("visibility", "visible")
            d3.selectAll(".tooltips").style("display", "block")
            geoMapHandler(config.mapConfig);
            sunburstHandler(config.sunburstData);
        }); 
           

    var verticalDateStart = svg.append("line")
            .attr("class", "date-select-line verticalDateStart")
            .attr("x1", 2)
            .attr("y1", 0)
            .attr("x2", 2)
            .attr("y2", config.height)
            .style("stroke-width", 4)
            .style("stroke", "#888")
            .style("fill", "none")
            .call(drag1);

    var verticalDateEnd = svg.append("line")
            .attr("class", "date-select-line verticalDateEnd")
            .attr("x1", width-2)
            .attr("y1", 0)
            .attr("x2", width-2)
            .attr("y2", config.height)
            .style("stroke-width", 4)
            .style("stroke", "#888")
            .style("fill", "none")
            .call(drag2);

    //make the arrow heads for the drag arrow
    d3.select(divID+" svg").append("marker")
        .attr({
            "id":"arrow-head",
            "viewBox":"0 0 10 10",
            "refX":-0.35,
            "refY":5,
            "markerWidth":3,
            "markerHeight":3,
            "orient":"auto",
            "fill":"#aaa",
        })
        .append("path")
        .attr("d", "M 0 3 L 3 5 L 0 7 z")
        .attr("class","arrow");

    d3.select(divID+" svg").append("marker")
        .attr({
            "id":"arrow-head-2",
            "viewBox":"0 0 10 10",
            "refX":8.35,
            "refY":5,
            "markerWidth":3,
            "markerHeight":3,
            "orient": "auto",
            "fill": "#aaa"
        })
        .append("path")
        .attr("d", "M 5 5 L 8 3 L 8 7 z")
        .attr("class","arrow");

    var dragArrow = d3.select(divID+" svg").append("line")
          .attr("x1", 0)
          .attr("y1", config.height - 15)
          .attr("x2", 0)
          .attr("y2", config.height - 15)
          .attr("opacity", 1)
          .style("stroke-width", 7)
          .style("stroke", "#aaa")
          .attr("fill", "#aaa")
          .attr("class", "drag-arrow dragArrow")
          .call(drag3)
          .attr("marker-end", "url(#arrow-head)")
          .attr("marker-start", "url(#arrow-head-2)")
          .attr("visibility", "hidden")
          .on("click", null)
          .on("dblclick",function(){
                trimStartDate = new Date(timeStartDate);
                trimEndDate = new Date(timeEndDate);
                geoMapHandler(config.mapConfig);
                sunburstHandler(config.sunburstData);
                d3.selectAll(".dragWhiteRectStart").attr("width", 0)
                d3.selectAll(".dragWhiteRectEnd").attr("width", 0).attr("x", width) 
                d3.selectAll(".verticalDateStart").attr("x1", 2).attr("x2", 2)
                d3.selectAll(".verticalDateEnd").attr("x1", width-2).attr("x2", width-2)
                d3.selectAll(".dragArrow").attr("visibility", "hidden")
          });

    if(divID == "#timeline-1"){
        $("#zoom-in-1").unbind('click').bind('click', function(e, triggered) { 
            zoomInHandler(config);
            if(!triggered){$("#zoom-in-2").trigger('click', true);}
        });
        $("#zoom-out-1").unbind('click').bind('click', function(e, triggered) { 
            zoomOutHandler(config);
            if(!triggered){$("#zoom-out-2").trigger('click', true);}
        });
    } else {
        $("#zoom-in-2").unbind('click').bind('click', function(e, triggered) { 
            zoomInHandler(config);
            if(!triggered){$("#zoom-in-1").trigger('click', true);}
        });
        $("#zoom-out-2").unbind('click').bind('click', function(e, triggered) { 
            zoomOutHandler(config);
            if(!triggered){$("#zoom-out-1").trigger('click', true);}
        });
    }
    // d3.select("#color-scheme").on("change", function() { colorSchemeHandler(config); });
}


/**
 * @param  {object} config object for timeline
 * Handles zooming in on timeline
 */
function zoomInHandler(config){
    if (config.width * 1.2 > chartBoxWidth * 5) {
        config.width = config.width;
    } else {
        config.width *= 1.2;
    }
    drawTimeline(config);
    if (lassoPolygon) {
        lassoHandler()
    }
    timelineUpdateWithZoom(config)
}


/**
 * @param  {object} config object for timeline
 * Handles zooming out on timeline
 */
function zoomOutHandler(config){
    if (config.width / 1.2 < chartBoxWidth) {
        config.width = chartBoxWidth;
    } else {
        config.width /= 1.2;
    }
    drawTimeline(config);
    if (lassoPolygon) {
        lassoHandler()
    }
    timelineUpdateWithZoom(config)
}

// /**
//  * @param  {object} config object for timeline
//  * Handles change in color scheme for flows
//  */
// function colorSchemeHandler(config){
//     config.color = d3.select("#color-scheme").node().value;
//     drawTimeline(config);
// }


function timelineUpdateWithZoom(config){
    startDate = new Date(trimStartDate);
    endDate = new Date(trimEndDate);
    if (trimStartDate == -1) startDate = new Date(timeStartDate);
    if (trimEndDate == -1) endDate = new Date(timeEndDate);
    var dateToXScale = d3.time.scale()
        .domain([new Date(timeStartDate), new Date(timeEndDate)])
        .range([0, width])
    d3.selectAll(".verticalDateStart").attr("x1", dateToXScale(startDate) > 2 ? dateToXScale(startDate) : 2).attr("x2", dateToXScale(startDate) > 2 ? dateToXScale(startDate) : 2)
    d3.selectAll(".dragWhiteRectStart").attr("width", dateToXScale(startDate) > 2 ? dateToXScale(startDate) - 2 : 0)
                        .attr("opacity", 0.6)
    d3.selectAll(".verticalDateEnd").attr("x1", dateToXScale(endDate) < width-2 ? dateToXScale(endDate) : width-2).attr("x2", dateToXScale(endDate) < width-2 ? dateToXScale(endDate) : width-2)
    d3.selectAll(".dragWhiteRectEnd").attr("width", width - dateToXScale(endDate))
        .attr("x", dateToXScale(endDate) + 2)
        .attr("opacity", 0.6)

    if ((dateToXScale(endDate) - dateToXScale(startDate)) < 0.9*config.width) {
        var newArrowX = (dateToXScale(endDate) + dateToXScale(startDate))/2
        d3.selectAll(".dragArrow").attr("visibility", "visibile").attr("x1", newArrowX-20).attr("x2", newArrowX+20)
    }

    var middleOfTrim = (parseFloat(d3.selectAll(".verticalDateStart").attr("x1")) + parseFloat(d3.selectAll(".verticalDateEnd").attr("x1")))/2
    $(divID1).scrollLeft(middleOfTrim - chartBoxWidth/2)
}


/**
 * Handles events post completion of lasso selection
 */
function lassoHandler(){
    // or check if a point is inside the selected path
    var items = []
    if(heatMapEnableBool){
        heatMapMarkers.forEach(function(item) {
            if (isMarkerInsidePolygon(item.marker, lassoPolygon)) {
                items.push(item)
            }
        })
    } else {
        markersArray.forEach(function(item) {
            if (isMarkerInsidePolygon(item.marker, lassoPolygon)) {
                items.push(item)
            }
        })
    }
    lassoTimelineHighlight(items)
}

/**
 * Handles disabling/enabling of lasso
 */
function lassoEnableHandler(){
    if ($("#icon-lasso").hasClass("active")) {
        lasso.mode(FreeDraw.NONE);
        lasso.clear();
        lassoPolygon = null;
        d3.selectAll(".chart svg").selectAll(".date-lasso-line").remove();
    } else {
        lasso.mode(FreeDraw.CREATE + FreeDraw.EDIT);
    }
    $("#icon-lasso").toggleClass("active");
}


/**
 * Handles resetting lasso
 */
function lassoResetHandler() {
    lasso.clear();
    lassoPolygon = null;
    d3.selectAll(".chart svg").selectAll(".date-lasso-line").remove()

    if ($("#icon-lasso").hasClass("active")) {
        lasso.mode(FreeDraw.CREATE + FreeDraw.EDIT);
    } else {
        lasso.mode(FreeDraw.NONE);
    }
}

/**
 * @param  {list} items markers/heatmap items inside the lasso
 * Highlights dates correspoding to lasso selection on timeline
 */
function lassoTimelineHighlight(items){
    d3.selectAll(".chart svg").selectAll(".date-lasso-line").remove()
    var svg1 = d3.select(divID1+" svg");
    var svg2 = d3.select(divID2+" svg");
    var x = d3.time.scale()
            .domain([new Date(timeStartDate), new Date(timeEndDate)])
            .range([0, width]);

    items.forEach(function(item){
        if(item.reliability == "official"){
            svg1.append("line")
                .attr("class", "date-lasso-line")
                .attr("x1", margin.left + x(new Date(item.date)))
                .attr("y1", margin.top)
                .attr("x2", margin.left + x(new Date(item.date)))
                .attr("y2", timelineHeight - 18)
                .style("stroke-width", 1)
                .style("stroke-dasharray", ("8, 8"))
                .style("stroke",item.key ? sunburstColorsCombined[item.key.replace(new RegExp('-', 'g'), "_")]: "#aaa")
                .style("fill", "none");
        } else if (item.reliability == "unofficial"){
            svg2.append("line")
                .attr("class", "date-lasso-line")
                .attr("x1", margin.left + x(new Date(item.date)))
                .attr("y1", margin.top)
                .attr("x2", margin.left + x(new Date(item.date)))
                .attr("y2", timelineHeight - 18)
                .style("stroke-width", 1)
                .style("stroke-dasharray", ("8, 8"))
                .style("stroke",item.key ? sunburstColorsCombined[item.key.replace(new RegExp('-', 'g'), "_")]: "#aaa")
                .style("fill", "none");
        } else {
            console.log("rss_reliability error")
        }
    })
}

/**
 * @param  {date} mouseDate the date to which the nearest date is to found in an array
 * @param  {list} datesArr the array used for finding nearesrt date
 * gives the nearesr date in the array
 */
function giveNearestDate(mouseDate, datesArr){
    var minDateDiff = new Date(datesArr[0]);
    datesArr.forEach(function (item) {
        if(Math.abs(new Date(mouseDate) - new Date(item)) < Math.abs(new Date(mouseDate) - new Date(minDateDiff))){
            minDateDiff = item;
        }
    })
    return minDateDiff;
}


/**
 * Handles the size of markers when zooming in/out on the map
 */
function mapZoomHandler() {
    markersArray.forEach(function(item) {
        item.marker.setRadius(giveRadiusForMarkersZoom())
        markers.addLayer(item.marker)
    })
}


/**
 * @return {int} radiusMultiplier
 * Returns the multiplier for size of markers on zomming in/out
 */
function giveRadiusForMarkersZoom(){
    var currentZoom = map.getZoom();
    var radiusMultiplier;

    if (currentZoom <= 1){ 
        radiusMultiplier = 1
    } else if (currentZoom <= 3) {
        radiusMultiplier = currentZoom + 1; 
    } else if (currentZoom <= 7) {
        radiusMultiplier = currentZoom + 2;
    } else { 
        radiusMultiplier = 8;
    }
    return radiusMultiplier;
}


/**
 * @param  {object} item jquery item
 * Handles enabling/disabling of heatmaps
 */
function heatMapHandler(bool) {
    heatMapEnableBool = bool;
    if (heatMapEnableBool) {
        $("#icon-points").removeClass("active");
        $("#icon-heatmap").addClass("active");
    } else {
        $("#icon-points").addClass("active");
        $("#icon-heatmap").removeClass("active");
    } 
    plotter();
    lasso.clear();
    lassoPolygon = null;
    d3.select(divID1+' svg').selectAll('.date-lasso-line').remove();
}

/**
 * Trims down the length of entity text on screen to fit in view
 * @param  {string} text original text
 * @return {string} trimmed down text
 */
function trimTextToFitOnScreen(text, size) {
    if (text.length > size) {
        return text.substr(0, size-2)+'...';
    }
    else {
        return text
    }
}


/**
 * Converts date object to string YYYY-MM-DD
 * @param  {object} date date in object
 * @return {[type]} date in YYYY-MM-DD string
 */
function dateObjectToString(date) {
  var yyyy = date.getFullYear().toString();
  var mm = (date.getMonth()+1).toString();
  var dd  = date.getDate().toString();

  var mmChars = mm.split('');
  var ddChars = dd.split('');

  return yyyy + '-' + (mmChars[1]?mm:"0"+mmChars[0]) + '-' + (ddChars[1]?dd:"0"+ddChars[0]);
}

/**
 * @param  {int} timelineNo the number of timeline which is collapsed
 * @param  {object} element jquery element
 * @param  {object} mapConfig config object for the geo map
 * Handles the collapsing of either of the timelines
 */
// function handleTimelineCollapse(timelineNo, element, mapConfig){
//     $("#timeline-"+timelineNo).slideToggle("slow");
//     if ($(element).html().split(" ")[0] == "Collapse"){
//         if (timelineNo == 1) { $("#zoom-container-1").hide()}
//         else if (timelineNo == 2) { $("#zoom-container-2").hide()}
//         $(element).html("Expand T"+timelineNo)
//         collapseTimelineNumber += 1;
//     } else {
//         if (timelineNo == 1) { $("#zoom-container-1").show()}
//         else if (timelineNo == 2) { $("#zoom-container-2").show()}
//         $(element).html("Collapse T"+timelineNo)
//         collapseTimelineNumber -= 1;
//     }

//     if(collapseTimelineNumber == 1){
//         $("#map").css("height", (300 + timelineHeight)+"px");
//         map.setView([35, 10], 2)
//     } else if (collapseTimelineNumber == 2){
//         $("#map").css("height", (300 + 2*timelineHeight)+"px");
//         map.setView([43, 15], 2)
//     } else {
//         $("#map").css("height", "300px");
//         map.setView([35, 10], 1)
//     }
// }

function confidenceSlider(val) {
    $($(".popover-title")[0]).html("Confidence Filter >= "+val);
    confidenceFilter = parseFloat($("#pop-over-slider").val())
    plotter();
}

function confidenceSliderSliding(val){
    $($(".popover-title")[0]).html("Confidence Filter >= "+val);
}


function markerModalHandler(articleID){
    var article = articleData[articleID];
    $("#markerPopUpModal .modal-content").empty();
    $("#markerPopUpModal .modal-content").append("<button onclick='closeMarkerModal();' class='close' aria-label='Close' ><span aria-hidden='true'>&times;</span></button>")
    $("#markerPopUpModal .modal-content").append("<h2>"+article["title"]+"</h2>")
    $("#markerPopUpModal .modal-content").append("<h4>"+article["source"]+"</h4>")
    $("#markerPopUpModal .modal-content").append("<a href='"+article["url"]+"' target='_blank'><h4>Document Source</h4></a>")
    $("#markerPopUpModal .modal-content").append("<p>"+article["text"]+"</p>")
    $("#markerPopUpModal").modal("show")
}

function closeMarkerModal(){
    $('#markerPopUpModal').modal('hide');
}

function fileModalHandler(){
    $("#official_upload_label").html(OFFICIAL_FILE_NAME);
    $("#unofficial_upload_label").html(UNOFFICIAL_FILE_NAME);
    $("#fileSelectModal").modal("show")
}

function fileLoadHandler(fileType, fileName){
    $("#"+fileType+"_upload_label").html(fileName)
    if (fileType == "official") {
        var file = document.querySelector('#officialCSV').files[0];
        var reader  = new FileReader();

        reader.addEventListener("load", function () {
            OFFICIAL_FILE = reader.result
            OFFICIAL_FILE_NAME =fileName;
            plotter(init=true);
        }, false);

        if (file) {
            reader.readAsDataURL(file);
        }
    } else if (fileType == "unofficial"){
        var file = document.querySelector('#unofficialCSV').files[0];
        var reader  = new FileReader();

        reader.addEventListener("load", function () {
            UNOFFICIAL_FILE = reader.result
            UNOFFICIAL_FILE_NAME =fileName;
            plotter(init=true);
        }, false);

        if (file) {
            reader.readAsDataURL(file);
        }
    } else {
        console.log("[ERROR] What are you uploading?")
    }
}

function sunburstHandler(sunburstData, trimmingBool=true){
    var startDate, endDate;
    if(trimmingBool){
        startDate = new Date(trimStartDate);
        endDate = new Date(trimEndDate);
        if (trimStartDate == -1) startDate = new Date(timeStartDate);
        if (trimEndDate == -1) endDate = new Date(timeEndDate);

    } else {
        startDate = new Date(timeStartDate);
        endDate = new Date(timeEndDate);
    }
    var reqSunburstData = sunburstData[mapDataSelector][0][DHSOrder]
    var reqSunburstDataTrimmed = []

    for (key in reqSunburstData){
        var countForCurrentKey = 0
        reqSunburstData[key].forEach(function(itemDate){
            if (new Date(itemDate) >= startDate && new Date(itemDate) <= endDate) {
                countForCurrentKey += 1
            }
        })
        if(countForCurrentKey > 0){
            reqSunburstDataTrimmed.push([key, countForCurrentKey])
        }
    }
    initSunburst(reqSunburstDataTrimmed, sunburstColorsCombined)
}

function getPopUpTriggerDistance(){
    var currentZoom = map.getZoom();
    if(currentZoom <= 6) {
        return 150/giveRadiusForMarkersZoom();
    } else if (currentZoom <=8) {
        return 15;
    } else {
        return 10;
    }
    
}