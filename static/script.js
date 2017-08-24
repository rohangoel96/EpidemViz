$(document).ready(function() {
    plotter();
});

var margin = {top: 20, right: 40, bottom: 30, left: 30};
var format = d3.time.format("%Y-%m-%d");
var chartBoxWidth = 0;

function plotter() {
    var dsv = d3.dsv(";", "text/plain");
    dsv("/static/data/"+$("input:radio[name=data-file]:checked").val()
        +".csv", function(error, data) {
            if (error) throw error;
            newData = processData(data, $("input:radio[name=data-type]:checked").val());
            newData.forEach(function(d) {
                d.date = format.parse(d.date);
                d.value = +d.value;
                d.key = d.key;
            });

            chartBoxWidth = $("#timeline").width() - margin.left - margin.right;

            chart({
                data: newData,
                color: $("#color-scheme").val(),
                margin: margin,
                width: chartBoxWidth,
                height: 400 - margin.top - margin.bottom
            });

    });
}

function processData(data, dataType) {
    var species_host = [],
            diseases = [],
            symptoms = []
            dates = [],
            processedData ={}, 
            keys = [];
    
    data.map(function(d) {
            species_host = species_host.concat(d.species.split(','));
            diseases = diseases.concat(d.diseases.split(','));
            symptoms = symptoms.concat(d.symptoms.split(','));
            dates.push(d.publication_date);
    });

    appendEntities("#entity-host", species_host, 'species_')
    appendEntities("#entity-diseases", diseases, 'diseases_')
    appendEntities("#entity-symptoms", symptoms, 'symptoms_')

    // default selection
    $('input[id^="disease"]').attr('checked', true);

    dates = _.uniq(dates)
    keys = []
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

    objList =  $('input[id^="'+dataType+'"]')    
    for (var i = objList.length - 1; i >= 0; i--) {
        if($(objList[i]).is(":checked")){
            keys.push(objList[i].name.split(""+dataType+"_")[1])
        }
    }
    
    function dateSorter (a,b){
    // Turn your strings into dates, and then subtract them
    // to get a value that is either negative, positive, or zero.
        return new Date(a) - new Date(b);
    };
    
    dates.sort(dateSorter)
    // console.log(keys);
    // console.log(dates);

    dates.forEach(function(date) {
        processedData[date] = {}
        keys.forEach(function(key) {
            processedData[date][key] = 0
        })
    })

    data.map(function(d) {
        d[dataType].split(',').forEach(function(key) {
            if (keys.indexOf(key) > -1) {
                processedData[d.publication_date][key] += 1
            }
        })
    })

    newData = []
    for (date in processedData) {
        for (key in processedData[date]){
            newData.push({
                "date": date,
                "key": key,
                "value": processedData[date][key]
            })
        }
    } 

    return newData
}

function appendEntities(containerID, objList, idText) {
    if(!($(containerID).find('input').length > 0)) {
        _.uniq(objList).forEach(function(item) {
                $(containerID).append(
                        $(document.createElement('label')).text(item)
                        .append(
                                $(document.createElement('input')).attr({
                                        id:    idText + item,
                                        name:  idText + item,
                                        value: idText + item,
                                        class: 'entities-checkbox',
                                        type:  'checkbox',
                                        onclick: 'plotter(this)'
                                })
                        )  
                );
        })
    }
}

function chart(config) {
    var margin = config.margin;
    var width = config.width;
    var height = config.height;
    var data = config.data;
    var color = config.color;

    var datearray = [];
    var colorrange = [];

    if (color == "blue") {
        colorrange = ["#045A8D", "#2B8CBE", "#74A9CF", "#A6BDDB", "#D0D1E6", "#F1EEF6"];
    }
    else if (color == "pink") {
        colorrange = ["#980043", "#DD1C77", "#DF65B0", "#C994C7", "#D4B9DA", "#F1EEF6"];
    }
    else if (color == "orange") {
        colorrange = ["#B30000", "#E34A33", "#FC8D59", "#FDBB84", "#FDD49E", "#FEF0D9"];
    }
    strokecolor = colorrange[0];

    var tooltip = d3.select("body")
            .append("div")
            .attr("class", "remove")
            .attr("id", "tooltip")
            .style("z-index", "20")
            .style("visibility", "hidden")

    var x = d3.time.scale()
            .range([0, width]);

    var y = d3.scale.linear()
            .range([height-10, 0]);

    var z = d3.scale.ordinal()
            .range(colorrange);

    var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom")
            .tickFormat(d3.time.format("%d/%m/%y"))
            .ticks(config.width/25)

    var stack = d3.layout.stack()
            .offset("silhouette")
            .values(function(d) { return d.values; })
            .x(function(d) { return d.date; })
            .y(function(d) { return d.value; });

    var nest = d3.nest()
            .key(function(d) { return d.key; });

    var area = d3.svg.area()
            .interpolate("cardinal")
            .x(function(d) { return x(d.date); })
            .y0(function(d) { return y(d.y0); })
            .y1(function(d) { return y(d.y0 + d.y); });

    d3.select(".chart svg").remove();
    var svg = d3.select(".chart").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var layers = stack(nest.entries(data));

    x.domain(d3.extent(data, function(d) { return d.date; }));
    y.domain([0, d3.max(data, function(d) { return d.y0 + d.y; })]);

    svg.selectAll(".layer")
        .data(layers)
        .enter().append("path")
        .attr("class", "layer")
        .attr("d", function(d) { return area(d.values); })
        .style("fill", function(d, i) { return z(i); });


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

    svg.selectAll(".layer")
        .attr("opacity", 1)
        .on("mouseover", function(d, i) {
            svg.selectAll(".layer").transition()
            .duration(250)
            .attr("opacity", function(d, j) {
                return j != i ? 0.6 : 1;
            })
        })
        .on("mousemove", function(d, i) {
            mouse = d3.mouse(this);
            mousex = mouse[0],
            mousey = mouse[1];
            var invertedx = x.invert(mousex);
            invertedx = invertedx.getMonth() + invertedx.getDate();
            var selected = (d.values);
            for (var k = 0; k < selected.length; k++) {
                datearray[k] = selected[k].date
                datearray[k] = datearray[k].getMonth() + datearray[k].getDate();
            }

            mousedate = datearray.indexOf(invertedx);
            pro = d.values[mousedate].value;

            d3.select(this)
                .classed("hover", true)
                .attr("stroke", strokecolor)
                .attr("stroke-width", "0.5px"); 

            tooltip.html( "<p>" + d.key + "<br>" + pro + "</p>" ).style("visibility", "visible")
            .style("left", ($("#timeline").offset().left + mousex) +"px")
            .style("top", ($("#timeline").offset().top + mousey - 100) +"px");
        })
        .on("mouseout", function(d, i) {
            svg.selectAll(".layer")
                .transition()
                .duration(250)
                .attr("opacity", "1");
            d3.select(this)
                .classed("hover", false)
                .attr("stroke-width", "0px"), tooltip.html( "<p>" + d.key + "<br>" + pro + "</p>" ).style("visibility", "hidden");
        })

    var vertical = d3.select(".chart")
            .append("div")
            .attr("class", "remove")
            .style("position", "absolute")
            .style("z-index", "19")
            .style("width", "1px")
            .style("height", "380px")
            .style("top", "10px")
            .style("bottom", "30px")
            .style("left", "0px")
            .style("background", "#fff");

    d3.select(".chart")
        .on("mousemove", function(){  
             mousex = d3.mouse(this);
             mousex = mousex[0] + 5;
             vertical.style("left", mousex + "px" )
         })
        .on("mouseover", function(){  
             mousex = d3.mouse(this);
             mousex = mousex[0] + 5;
             vertical.style("left", mousex + "px")
         });

    d3.select("#zoom-in").on("click", function() { zoomInHandler(config); });
    d3.select("#zoom-out").on("click", function() { zoomOutHandler(config); });
    d3.select("#color-scheme").on("change", function() { colorSchemeHandler(config); });
}

function zoomInHandler(config){
    if (config.width * 1.2 > chartBoxWidth * 5) {
        config.width = config.width;
    } else {
        config.width *= 1.2;
    }
    chart(config);
}

function zoomOutHandler(config){
    if (config.width / 1.2 < chartBoxWidth) {
        config.width = chartBoxWidth;
    } else {
        config.width /= 1.2;
    }
    chart(config);
}

function colorSchemeHandler(config){
    config.color = d3.select("#color-scheme").node().value;
    chart(config);
}