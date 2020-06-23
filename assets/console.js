(function() {

  //Globals
  var db = firebase.firestore(),
    /**
    CT -> Catch thread; sometimes, when adding HTML to elements using insertAdjacentHTML
    or appending innerHTML does not take effect immediately.
    This basically kicks the function into asynchronosity.
    f -> callback function to be executed asynchronously.
    */
    ct = (f) => {
      setTimeout(f, 1);
    },
    /**
    Common -> Object used to export functions between blocks and to store common info like circuit
    and category representations.
    */
    common = {
      workingCopies: {}
    };

  (function() {
    //BLOCK — Sanitize

    /**
    Sanitize -> Use createElement to remove all special characters which would form HTML elements.
    */
    common.sanitize = (text) => {
      var el = document.createElement("div");
      el.innerText = text;
      var sanitized = el.innerHTML;
      // delete el;
      return sanitized;
    };

  })();

  (function() {
    //BLOCK — Global Keydowns & hook

    /**
    keysCurrentlyPressed -> object
    */
    common.keysCurrentlyPressed = {};
    document.onkeydown = (e) => {
      common.keysCurrentlyPressed[e.key.toLowerCase()] = true;
    };
    document.onkeyup = (e) => {
      common.keysCurrentlyPressed[e.key.toLowerCase()] = false;
    };

  })();

  (function() {
    //BLOCK — Authentication

    /**
    If the user is logged in, check if they are an admin
    and redirect to the login screen if not.

    */
    firebase.auth().onAuthStateChanged(function(user) {
      if (user) {
        var admins = db.collection("users").doc("admins");
        admins.get().catch(() => {
          firebase.auth().signOut().then(() => {
            location.assign("..");
          });
        });
      } else {
        location.assign("..");
      }
    });

    /**
      Link up log-out button to sign user out.
    */
    var $logoutButton = document.getElementById("console-logOutButton");
    $logoutButton.onclick = () => {
      firebase.auth().signOut();
    };

  })();

  /*(() => {
    //BLOCK — Lock
    firebase.database().ref("lock").on("value", (lockSnapshot, error) => {
      if (error) {
        alert("Sorry! You've been locked out. Ask the other users who is online or send Ari a text and he will remove the lock.");
        location.assign("..");
        return;
      }
      var lock = lockSnapshot.val();
      if (lock && lock.user && lock.user != firebase.auth().currentUser.uid) {
        console.log("fail condition");
        alert("Sorry! You've been locked out. Ask the other users who is online or send Ari a text and he will remove the lock.");
        location.assign("..");
        return;
      } else {
        firebase.database().ref("lock").set({
          user: firebase.auth().currentUser.uid
        }, (error) => {
          if (error) {
            console.log("fail condition ", error);
            firebase.database().ref("lock").onDisconnect().remove();
            return;
          }
          firebase.database().ref("lock").onDisconnect().remove();
        });
      }
    });
  })();*/

  (function() {
    //BLOCK — Categories

    /**
    Load Categories -> Load the categories from the firestore,
    return a promise; promise resolves with category information
    and add information to workingCopies.
    */
    var loadCategories = () => {
      return new Promise((resolve, reject) => {
        var categoriesReference = db.collection("categories");
        categoriesReference.get().then((categoryDocumentsSnapshot) => {
          var categoryDocuments = categoryDocumentsSnapshot.docs,
            categories = categoryDocuments.map((document) => {
              return {
                key: document.id,
                data: document.data()
              };
            });
          common.workingCopies.categories = categories;
          resolve(categories);
        }).catch((categoriesError) => {
          reject(categoriesError);
        });
      });
    };

    //Add loadCategories to common.
    common.loadCategories = loadCategories;

  })();


  (function() {
    //BLOCK — Circuits

    /**
      LoadCircuits -> Load the circuits from the firstore; return promise that resolves to a list of circuits
    */
    var loadCircuits = () => {
      return new Promise((resolve, reject) => {
        var circuitsReference = db.collection("circuits");
        circuitsReference.get().then((circuitDocumentsSnapshot) => {
          var circuitDocuments = circuitDocumentsSnapshot.docs,
            //Filter out deleted circuits
            circuits = circuitDocuments.filter((circuitDocumentSnapshot) => circuitDocumentSnapshot.data().category != "deleted")
            //Parse circuits and store the parsed information with stored information.
            .map((circuitDocumentSnapshot) => {
              var circuitDocument = circuitDocumentSnapshot.data(),
                circuitID = circuitDocumentSnapshot.id,
                circuitInstructions = circuitDocument.instructions,
                circuitDocumentData = consoleCircuits.parseCircuit(circuitInstructions);
              return {
                storedDocument: circuitDocument,
                parsedCircuit: circuitDocumentData,
                circuitID: circuitID
              };
            })
            //Sort by category title, then circuit key
            .sort((a, b) => {
              var catA = a.storedDocument.category;
              var catB = b.storedDocument.category;
              if (catA < catB) return -1;
              if (catA == catB) {
                var refA = a.circuitID,
                  refB = b.circuitID;
                if (refA > refB) return -1;
                return 1;
              }
              return 1;
            });
          common.workingCopies.circuits = circuits;
          resolve(circuits);
        }).catch((circuitsError) => {
          reject(circuitsError);
        });
      });
    };

    //Add LoadCircuits to common.
    common.loadCircuits = loadCircuits;

  })();

  (function() {
    //BLOCK — categories

    /**
    Load & Render Categories View -> Load categories and add the rendered
    list to the DOM
    */
    var loadAndRenderCategoriesView = () => {
        return new Promise((resolve, reject) => {
          //Load circuits for circuits count
          common.loadCircuits().then((circuits) => {
            //Load remote category data & update working copy
            common.loadCategories().then((categories) => {
              $categoriesList.innerHTML = "";
              //For each category, get the count...
              categories.map((category) => {
                  var categoryCode = category.data.category,
                    count = circuits
                    .filter((circuit) => circuit.storedDocument.category == categoryCode)
                    .length;
                  category.count = count;
                  return category;
                })
                //...and generate row
                .filter((category) => category.data.header)
                .forEach((category) => {
                  $categoriesList.innerHTML += generateCategoryEditRow(category);
                  ct(() =>
                    //Link individual controls
                    linkUpCategoryEditRow($categoriesList.querySelector(".console-category-edit-row[data-categoryref='" + category.key + "']"))
                  );
                });
              resolve();
            }).catch((x) => {
              reject(x);
            });
          }).catch((x) => reject(x));
        });
      },
      ///Generate Category Editor Row -> Replace data inside template
      generateCategoryEditRow = (category) => {
        return categoryEditRowTemplate
          .replace(/%categoryKey%/g, common.sanitize(category.key))
          .replace(/%name%/g, common.sanitize(category.data.header))
          .replace(/%count%/g, common.sanitize(category.count))
          .replace(/%invertedDisplayProperty%/g, category.count <= 0 ? "d-none" : "")
          .replace(/%displayProperty%/g, category.count > 0 ? "d-none" : "");
      },
      linkUpCategoryEditRow = ($row) => {
        // console.log($row);
        var $renameElement = $row.querySelector(".console-category-rename"),
          $deleteButton = $row.querySelector(".console-category-deleteButton"),
          $insertButtons = [].slice
          .call($row.getElementsByClassName("console-category-insertCategoryBelow")),
          key = $row.getAttribute("data-categoryref");

        $insertButtons.forEach(($insertButton) => {
          $insertButton.onclick = () => {
            var newCategoryKey = key + "pl" + Math.floor(new Date().getTime() / 1000),
              newCategoryObject = {
                category: "" + Math.floor(new Date().getTime() / 1000),
                header: "New Category"
              };
            db.collection("categories").doc(newCategoryKey).set(newCategoryObject);
            var newRow = generateCategoryEditRow({
              key: newCategoryKey,
              count: 0,
              data: newCategoryObject
            });
            $row.insertAdjacentHTML("afterend", newRow);
            ct(() =>
              linkUpCategoryEditRow(document.querySelector(".console-category-edit-row[data-categoryref='" + newCategoryKey + "']"))
            );
          };
        });

        $renameElement.onclick = (e) => {
          $renameElement.contentEditable = true;
          $renameElement.focus();
          e.preventDefault()
        };
        $renameElement.onkeypress = (e) => {
          if (e.code == "Enter") {
            saveRename();
            e.preventDefault();
          }
        };
        var saveRename = $renameElement.onblur = () => {
          $renameElement.contentEditable = false;
          var textToRename = $renameElement.innerText = $renameElement.innerText.trim().replace(/\n|\r/g, "").substr(0, 50);
          if (textToRename == "") $renameElement.innerText = textToRename = "Category Name";
          db.collection("categories").doc(key).update({
            "header": textToRename
          });
        };
        $deleteButton.onclick = () => {
          if ((common.keysCurrentlyPressed.shift ? false : !confirm("Are you sure you want to delete this category?"))) return;
          var dbRef = db.collection("categories").doc(key)
          dbRef.get().then((dbSnapshot) => {
            // var header = dbSnapshot.data().header;
            dbRef.delete();
          });
          $row.parentNode.removeChild($row);
        };

      },
      activateCategoriesView = () => {
        $focusCategoriesButton.disabled = true;
        $focusCategoriesButton.innerText = "Loading...";
        loadAndRenderCategoriesView().then(() => {
          $prelimContainer.style.display = "none";
          $focusCategoriesButton.disabled = false;
          $focusCategoriesButton.innerText = "Categories";
          $console.setAttribute("class", $console.getAttribute("class").replace(/d-none/g, "d-block"));
        }).catch((x) => console.error(x));
      },
      windDownCategoriesView = () => {
        $prelimContainer.style.display = "block";
        document.getElementById("console-categoriesConsole-categoriesList").innerHTML = "";
        $console.setAttribute("class", $console.getAttribute("class").replace(/d-block/g, "d-none"));
      },
      $categoriesList = document.getElementById("console-categoriesConsole-categoriesList"),
      $console = document.getElementById("console-categoriesConsole"),
      $prelimContainer = document.getElementById("console-prelimContainer"),
      // $prelimCategoriesContainer = document.getElementById("console-categoriesContainer"),
      $focusCategoriesButton = document.getElementById("console-focusCategoriesButton"),
      $unfocusCategoriesButton = document.getElementById("console-categoriesConsole-closeButton"),
      categoryEditRowTemplate = document.getElementById("console-template-categoryEditRow").innerHTML;

    $focusCategoriesButton.onclick = activateCategoriesView;
    $unfocusCategoriesButton.onclick = windDownCategoriesView;
  })();

  (function() {
    //BLOCK — Circuit

    var activateCircuitView = function() {
        $focusCircuitsButton.disabled = true;
        $focusCircuitsButton.innerText = "Loading...";
        beginCircuitConsole().catch((x) => console.error(x)).then(() => {
          $prelimContainer.style.display = "none";
          $focusCircuitsButton.innerText = "Circuits";
          $console.style.display = "block";
          $console.setAttribute("class", [].slice.call($console.classList).join(" ").replace("d-none", "d-block"));
        });
      },
      beginCircuitConsole = function() {
        return new Promise((resolve, reject) => {
          var $circuitsList = document.getElementById("console-circuitsConsole-circuitsList");
          $circuitsList.innerHTML = document.getElementById("console-template-newCircuitRow").innerHTML;

          common.loadCategories().then((categories) => {
            common.loadCircuits().then((circuits) => {
              var categoryOptions = (() => {
                return categories.sort((a, b) => {
                  if (!a.data.header) {
                    return 1;
                  }
                  if (!b.data.header) {
                    return -1;
                  }
                  if (a.key > b.key) {
                    return 1;
                  }
                  if (b.key > a.key) {
                    return -1;
                  }
                  return 0;
                }).filter((category) => category.data.formerHeader || category.data.header).map((category, i) => {
                  return "<option " + (!category.data.header ? "disabled" : "") + " value='" +
                    common.sanitize(category.data.category) +
                    "'>" +
                    common.sanitize(category.data.header ? category.data.header : "[deleted category, formerly " +
                      category.data.formerHeader + "]") +
                    "</option>";
                }).join("");
              })();

              var $createCircuitSelector = $circuitsList.querySelector(".console-circuits-newCircuitRow-category");
              $createCircuitSelector.innerHTML = categoryOptions;


              linkControlsAndNewCircuit($circuitsList, categoryOptions);

              // console.log($createCircuitButton);
              // console.log($createCircuitButton.onclick);

              circuits.forEach((circuit, key) => {
                categories.forEach((category) => {
                  if (category.data.category == circuit.storedDocument.category) {
                    circuit.category = category.data.category;
                  }
                });
                createCircuitRow($circuitsList, circuit, categoryOptions);
              });

              resolveAllCircuitRows();

              resolve();
            }).catch((x) => reject(x));
          }).catch((x) => reject(x));
        });
      },
      linkControlsAndNewCircuit = function($circuitsList, categoryOptions) {
        ct(() => {
          var $createCircuitButton = $circuitsList.querySelector(".console-circuits-newCircuitRow-createButton");
          var $createCircuitSelectorNC = $circuitsList.querySelector(".console-circuits-newCircuitRow-category");
          $createCircuitButton.onclick = () => {
            // console.log($createCircuitButton);
            var category = $createCircuitSelectorNC.value,
              newCircuitID = "zzC-" + new Date().getTime(),
              d = new Date(),
              dateCode = (d.getYear() + 1900) + "." + ((d.getMonth() + 1) + ".").padStart(3, "0") + (d.getDate() + "").padStart(2, "0"),
              newCircuit = {
                category: category,
                title: "New Circuit " + dateCode,
                instructions: "disp|New Circuit " +
                  dateCode + ";tex|Exercise Title|0|60;tex|Break|0|60;"
              };

            db.collection("circuits").doc(newCircuitID).set(newCircuit).then(() => {
                var name = newCircuit.title,
                  circuitKey = newCircuitID,
                  parsedCircuit = consoleCircuits.parseCircuit(newCircuit.instructions),
                  instructions = parsedCircuit.instructions,
                  $createCircuitRow = $createCircuitButton.parentNode.parentNode.parentNode;
                common.workingCopies.circuits.push({
                  storedDocument: newCircuit,
                  parsedCircuit: parsedCircuit,
                  circuitID: circuitKey
                });
                $createCircuitRow.insertAdjacentHTML("afterend", circuitNameTemplate
                  .replace(/%key%/g, common.sanitize(circuitKey))
                  .replace(/%name%/g, common.sanitize(name))
                  .replace(/%options%/g, categoryOptions));
                var $circuitEditList = [].slice
                  .call(document.getElementsByClassName("console-circuit-edit-list"))
                  .filter(($list) => {
                    return $list.getAttribute("data-circuitKey") == circuitKey;
                  })[0];

                instructions.forEach((instruction) => {
                  var instructionUUID = instruction.uuid;
                  $circuitEditList.innerHTML += circuitEditRowTemplate
                    .replace(/%instructionType%/g, common.sanitize(instruction.type))
                    .replace(/%key%/g, common.sanitize(circuitKey))
                    .replace(/%instructionIndex%/g, common.sanitize(instruction.uuid));
                  ct(() =>
                    linkHighLevelControlsForInstruction(newCircuit, circuitKey, instructionUUID, instruction)
                  );
                });
              })
              .catch((x) => console.error(x));
          };
        });
      },
      linkHighLevelControlsForInstruction = function(newCircuit, circuitKey, instructionUUID, instruction) {
        var $selector = document.querySelector(".console-circuit-instruction-instructionType[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(instructionUUID) + "']");
        $selector.value = instruction.type;
        $selector.onchange = () => {
          common.dataUtilities.handleExerciseTypeChange(circuitKey, instructionUUID, $selector.value);
        }

        var $controlsContainer = document.querySelector(".console-circuit-instructionEditor[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(instructionUUID) + "']");
        $controlsContainer.innerHTML = buildControlsForInstruction(instruction);
        ct(() =>
          common.linkControlsForInstruction($controlsContainer, instruction, circuitKey)
        );

        var $addButton = document.querySelector(".console-circuit-instruction-addButton[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(instructionUUID) + "']");
        $addButton.onclick = () => common.dataUtilities.insertExercise(circuitKey, instructionUUID);

        var $deleteButton = document.querySelector(".console-circuit-instruction-deleteButton[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(instructionUUID) + "']");
        $deleteButton.onclick = () => common.dataUtilities.deleteExercise(circuitKey, instructionUUID, $deleteButton.parentNode.parentNode.parentNode.parentNode.parentNode);


        ct(() => document.querySelector(".console-circuit-categorySelect[data-circuitKey='" + circuitKey + "']").value = newCircuit.category);

        ct(resolveAllCircuitRows);
      }
    resolveAllCircuitRows = function() {
        [].slice
          .call(document.getElementsByClassName("console-circuit-categorySelect"))
          .forEach(($categorySelect) => {
            $categorySelect.onchange = () => {
              var key = $categorySelect.getAttribute("data-circuitkey");
              var newCategory = $categorySelect.value;
              db.collection("circuits").doc(key).update({
                category: newCategory
              });
            }
          });
        [].slice
          .call(document.getElementsByClassName("console-circuit-deleteButton"))
          .forEach(($deleteButton) => {
            var key = $deleteButton.getAttribute("data-circuitkey");
            $deleteButton.onclick = () => {
              if ((common.keysCurrentlyPressed.shift ? false : !confirm("Are you sure you want to delete this circuit?"))) return;
              db.collection("circuits").doc(key).update({
                category: "deleted"
              }).then(() => {
                var $el = $deleteButton.parentNode.parentNode.parentNode.parentNode.parentNode;
                $el.parentNode.removeChild($el);
              }).catch(() => {
                alert("Deletion failed");
              });
            }
          });
        [].slice
          .call(document.getElementsByClassName("console-circuit-rename"))
          .forEach(($renameElement) => {
            var key = $renameElement.getAttribute("data-circuitkey");
            $renameElement.onclick = (e) => {
              $renameElement.contentEditable = true;
              $renameElement.focus();
              e.preventDefault()
            };
            $renameElement.onkeypress = (e) => {
              if (e.code == "Enter") {
                saveRename();
                e.preventDefault();
              }
            };
            var saveRename = $renameElement.onblur = () => {
              $renameElement.contentEditable = false;
              var textToRename = $renameElement.innerText = $renameElement.innerText.trim().replace(/\n|\r/g, "").substr(0, 50);
              if (textToRename == "") $renameElement.innerText = textToRename = "Circuit Name";
              db.collection("circuits").doc(key).update({
                "title": textToRename
              });
            }
          });
        [].slice
          .call(document.getElementsByClassName("console-circuit-editButton"))
          .forEach(($editButton) => {
            var key = $editButton.getAttribute("data-circuitkey");
            $editButton.onclick = () => {
              var $circuitEditList = document.querySelector(".console-circuit-edit-list[data-circuitkey='" + key + "'");
              // console.log($circuitEditList);
              classes = $circuitEditList.getAttribute("class");
              // console.log(classes);
              if (classes.indexOf("d-none") != -1) {
                $editButton.innerText = "Save";
                $editButton.setAttribute("class", $editButton.getAttribute("class").replace(/btn-primary/g, "btn-success"))
                $circuitEditList.setAttribute("class", classes.replace(/d-none/g, "d-block"));
              } else {
                var workingCopy = (() => common.workingCopies.circuits.map((circuit, i) => [i, circuit]).filter((circuit) => circuit[1].circuitID == key)[0][1])();
                $editButton.disabled = true;
                common.dataUtilities.writeCircuit(workingCopy).then(() => {
                  $editButton.innerText = "Edit";
                  $editButton.disabled = false;
                  $editButton.setAttribute("class", $editButton.getAttribute("class").replace(/btn-success/g, "btn-primary"))
                  $circuitEditList.setAttribute("class", classes.replace(/d-block/g, "d-none"));
                });
              }
            };
          });
      },
      createCircuitRow = function($circuitsList, circuit, categoryOptions) {
        var name = circuit.storedDocument.title,
          circuitKey = circuit.circuitID,
          instructions = circuit.parsedCircuit.instructions;

        $circuitsList.innerHTML += circuitNameTemplate
          .replace(/%key%/g, common.sanitize(circuitKey))
          .replace(/%name%/g, common.sanitize(name))
          .replace(/%options%/g, categoryOptions);

        ct(() => {
          document.querySelector(".console-circuit-categorySelect[data-circuitKey='" + circuitKey + "']").value = circuit.storedDocument.category;
        });
        var $circuitEditList = [].slice
          .call(document.getElementsByClassName("console-circuit-edit-list"))
          .filter(($list) => {
            return $list.getAttribute("data-circuitKey") == circuitKey;
          })[0];

        instructions.forEach((instruction) => {
          var instructionUUID = instruction.uuid;
          $circuitEditList.innerHTML += circuitEditRowTemplate
            .replace(/%instructionType%/g, common.sanitize(instruction.type))
            .replace(/%key%/g, common.sanitize(circuitKey))
            .replace(/%instructionIndex%/g, common.sanitize(instruction.uuid));
          ct(() => {
            var $selector = document.querySelector(".console-circuit-instruction-instructionType[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(instructionUUID) + "']");
            $selector.value = instruction.type;
            $selector.onchange = () => {
              common.dataUtilities.handleExerciseTypeChange(circuitKey, instructionUUID, $selector.value);
            }

            var $controlsContainer = document.querySelector(".console-circuit-instructionEditor[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(instructionUUID) + "']");
            $controlsContainer.innerHTML = buildControlsForInstruction(instruction);
            ct(() => common.linkControlsForInstruction($controlsContainer, instruction, circuitKey));

            var $addButton = document.querySelector(".console-circuit-instruction-addButton[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(instructionUUID) + "']");
            $addButton.onclick = () => common.dataUtilities.insertExercise(circuitKey, instructionUUID);

            var $deleteButton = document.querySelector(".console-circuit-instruction-deleteButton[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(instructionUUID) + "']");
            $deleteButton.onclick = () => common.dataUtilities.deleteExercise(circuitKey, instructionUUID, $deleteButton.parentNode.parentNode.parentNode.parentNode.parentNode);

          });
        });
      },
      linkControlsForInstruction = function($instructionControls, instruction, circuitKey) {
        var instructionType = instruction.type,
          uuid = instruction.uuid,
          findIndices = function() {
            var workingCopy = (() => common.workingCopies.circuits.map((circuit, i) => [i, circuit]).filter((circuit) => circuit[1].circuitID == circuitKey)[0])(),
              instructions = workingCopy[1].parsedCircuit.instructions,
              arrayIndex = (() => instructions.map((instruction, i) => [i, instruction]).filter((instruction) => {
                return instruction[1].uuid == uuid;
              })[0][0])();
            return {
              workingCopyIndex: workingCopy[0],
              instructionIndex: arrayIndex
            };
          };
        switch (instructionType) {
          case "interruption":
            break;
          case "comment":
          case "displayName":
            var $control = $instructionControls.getElementsByClassName("console-circuit-instruction-control-data")[0];
            $control.oninput = () => {
              var indices = findIndices();
              common.workingCopies
                .circuits[indices.workingCopyIndex]
                .parsedCircuit
                .instructions[indices.instructionIndex].data = $control.value;
            };
            break;
          case "repExercise":
            var $controlsR = [".console-circuit-instruction-control-name", ".console-circuit-instruction-control-reps"].map((el) => $instructionControls.querySelector(el));
            $controlsR.forEach(($control, i) => {
              $control.oninput = () => {
                var indices = findIndices();
                common.workingCopies
                  .circuits[indices.workingCopyIndex]
                  .parsedCircuit
                  .instructions[indices.instructionIndex]
                  .data[i == 0 ? "exerciseName" : "reps"] = $control.value;
              };
            });
            break;
          case "timedExercise":
            var $controlsT = ["console-circuit-instruction-control-name", "console-circuit-instruction-control-length"].map((el) => $instructionControls.getElementsByClassName(el)[0]);
            $controlsT.forEach(($control, i) => {
              $control.oninput = () => {
                var indices = findIndices();
                common.workingCopies
                  .circuits[indices.workingCopyIndex]
                  .parsedCircuit
                  .instructions[indices.instructionIndex]
                  .data[i == 0 ? "exerciseName" : "length"] = (i == 0 ? $control.value : ($control.value.trim() == "" ? 0 : parseInt($control.value)));
              };
            });

            break;
        }
      },
      buildControlsForInstruction = function(instruction) {
        var instructionType = instruction.type,
          template = tokenTemplates[instructionType];
        switch (instructionType) {
          case "interruption":
            return template;
            break;
          case "comment":
          case "displayName":
            return template.replace(/%data%/g, common.sanitize(instruction.data));
            break;
          case "repExercise":
            return template
              .replace(/%exerciseName%/g, common.sanitize(instruction.data.exerciseName))
              .replace(/%exerciseReps%/g, common.sanitize(instruction.data.reps));
            break;
          case "timedExercise":
            return template
              .replace(/%exerciseName%/g, common.sanitize(instruction.data.exerciseName))
              .replace(/%exerciseLength%/g, common.sanitize(instruction.data.length));
        }
      },
      deactivateCircuitView = function() {
        $prelimContainer.style.display = "block";
        $console.setAttribute("class", [].slice.call($console.classList).join(" ").replace("d-block", "d-none"));
        $focusCircuitsButton.disabled = false;
        document.getElementById("console-circuitsConsole-circuitsList").innerHTML = "";
      },
      $focusCircuitsButton = document.getElementById("console-focusCircuitsButton"),
      $closeCircuitsButton = document.getElementById("console-circuitsConsole-closeButton"),
      // $circuitsContainer = document.getElementById("console-circuitsContainer"),
      $console = document.getElementById("console-circuitsConsole"),
      $prelimContainer = document.getElementById("console-prelimContainer"),
      circuitNameTemplate = document.getElementById("console-template-circuitName").innerHTML,
      circuitEditRowTemplate = document.getElementById("console-template-circuitEditRow").innerHTML,
      tokenTemplates = (() => {
        var tokens = []
        var commandTokens = consoleCircuits.commandTokens;
        for (var tokenName in commandTokens) {
          tokens.push(tokenName);
        }
        var templates = {};
        tokens.forEach((token) => {
          templates[token] = document.getElementById("console-template-" + token + "InstructionRow").innerHTML;
        });
        return templates;
      })();
    // ,
    // $otherContainers = ["console-categoriesContainer", "console-categorySpacer"].map((el) => {
    //   return document.getElementById(el);
    // });

    $focusCircuitsButton.onclick = activateCircuitView;

    $closeCircuitsButton.onclick = deactivateCircuitView;

    common.buildControlsForInstruction = buildControlsForInstruction;

    common.linkControlsForInstruction = linkControlsForInstruction;

  })();

  (function() {
    //BLOCK — Data Utilities
    common.dataUtilities = {
      insertExercise: function(circuitKey, uuidBefore) {
        var workingCopy = (() => common.workingCopies.circuits.map((circuit, i) => [i, circuit]).filter((circuit) => circuit[1].circuitID == circuitKey)[0])(),
          instructions = workingCopy[1].parsedCircuit.instructions,
          $elementAfter = document.querySelector(".console-circuit-instruction-row[data-circuitkey='" + circuitKey + "'][data-instructionindex='" + uuidBefore + "']"),
          newUUID = consoleCircuits.generateUUID(),
          isShiftDown = !(!(common.keysCurrentlyPressed.shift)),
          toInsert = document
          .getElementById("console-template-circuitEditRow")
          .innerHTML
          .replace(/%instructionType%/g, "interruption")
          .replace(/%key%/g, common.sanitize(circuitKey))
          .replace(/%instructionIndex%/g, common.sanitize(newUUID)),
          arrayBeforeIndex = (() => {
            return instructions.map((instruction, i) => [i, instruction]).filter((instruction) => {
              return instruction[1].uuid == uuidBefore;
            })[0];
          })()[0];
        instructions.splice(arrayBeforeIndex + 1, 0, {
          type: "interruption",
          uuid: newUUID

        });
        common.workingCopies.circuits[workingCopy[0]].parsedCircuit.instructions = instructions;
        $elementAfter.insertAdjacentHTML("afterend", toInsert);
        ct(() => {
          var $selector = document.querySelector(".console-circuit-instruction-instructionType[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(newUUID) + "']");
          $selector.value = isShiftDown ? "timedExercise" : "interruption";
          $selector.onchange = () => {
            common.dataUtilities.handleExerciseTypeChange(circuitKey, newUUID, $selector.value);
          }
          var $addButton = document.querySelector(".console-circuit-instruction-addButton[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(newUUID) + "']");
          $addButton.onclick = () => {
            common.dataUtilities.insertExercise(circuitKey, newUUID);
          };

          var $deleteButton = document.querySelector(".console-circuit-instruction-deleteButton[data-circuitkey='" + common.sanitize(circuitKey) + "'][data-instructionindex='" + common.sanitize(newUUID) + "']");
          $deleteButton.onclick = () => {
            common.dataUtilities.deleteExercise(circuitKey, newUUID, $deleteButton.parentNode.parentNode.parentNode.parentNode.parentNode);
          };

          if (isShiftDown) {
            ct(() => {
              this.handleExerciseTypeChange(circuitKey, newUUID, "timedExercise");
            });
          }

        });
      },
      deleteExercise: function(circuitKey, uuid, $instructionRow) {
        var workingCopy = (() => common.workingCopies.circuits.map((circuit, i) => [i, circuit]).filter((circuit) => circuit[1].circuitID == circuitKey)[0])(),
          instructions = workingCopy[1].parsedCircuit.instructions,
          arrayIndex = (() => {
            return instructions.map((instruction, i) => [i, instruction]).filter((instruction) => {
              return instruction[1].uuid == uuid;
            })[0][0];
          })();
        if (instructions.length == 1) {
          alert("Cannot delete the last exercise, sorry!");
          return;
        }
        instructions.splice(arrayIndex, 1);
        $instructionRow.parentNode.removeChild($instructionRow);
      },
      handleExerciseTypeChange: function(circuitKey, uuid, newType) {
        var workingCopy = (() => common.workingCopies.circuits.map((circuit, i) => [i, circuit]).filter((circuit) => circuit[1].circuitID == circuitKey)[0])(),
          instructions = workingCopy[1].parsedCircuit.instructions,
          arrayIndex = (() => {
            return instructions.map((instruction, i) => [i, instruction]).filter((instruction) => {
              return instruction[1].uuid == uuid;
            })[0][0];
          })(),
          oldType = instructions[arrayIndex].type,
          oldData = instructions[arrayIndex].data,
          transferredData = "";
        switch (oldType) {
          case "displayName":
          case "comment":
            transferredData = oldData;
            break;
          case "repExercise":
          case "timedExercise":
            transferredData = oldData.exerciseName;
            break;
          default:
            break;
        }
        var newData;
        switch (newType) {
          case "displayName":
          case "comment":
            newData = transferredData;
            break;
          case "repExercise":
            newData = {
              exerciseName: transferredData,
              reps: ""
            };
            break;
          case "timedExercise":
            newData = {
              exerciseName: transferredData,
              length: 60
            };
            break;
        };

        instructions[arrayIndex].type = newType;
        instructions[arrayIndex].data = newData;

        var $circuitEditor = document.querySelector(".console-circuit-instructionEditor[data-circuitkey='" + circuitKey + "'][data-instructionindex='" + uuid + "']");

        $circuitEditor.innerHTML = common.buildControlsForInstruction(instructions[arrayIndex]);

        ct(() =>
          common.linkControlsForInstruction($circuitEditor, instructions[arrayIndex], circuitKey)
        );

        common.workingCopies.circuits[workingCopy[0]].parsedCircuit.instructions = instructions;
      },
      writeCircuit: function(workingCopy) {
        return new Promise((resolve, reject) => {
          var circuitKey = workingCopy.circuitID,
            instructions = workingCopy.parsedCircuit.instructions
          circuitInstructions = consoleCircuits.writeCircuit(instructions),
            db.collection("circuits").doc(circuitKey).update({
              instructions: circuitInstructions
            }).then(resolve).catch((reject));
        });
      }
    };
  })();

  window.consoleExports = common;

})();
