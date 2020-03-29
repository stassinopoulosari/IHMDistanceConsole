(() => {

  //Globals
  var db = firebase.firestore();
  var exports = {
    workingCopies: {}
  };

  (() => {
    //BLOCK — Sanitize

    exports.sanitize = (text) => {
      var el = document.createElement("div");
      el.innerText = text;
      var sanitized = el.innerHTML;
      delete el;
      return sanitized;
    };

  })();

  (() => {
    //BLOCK — Global Keydowns

    exports.keysCurrentlyPressed = {};
    document.onkeydown = (e) => {
      exports.keysCurrentlyPressed[e.code] = true;
    };
    document.onkeyup = (e) => {
      exports.keysCurrentlyPressed[e.code] = false;
    };
  })();

  (() => {
    //BLOCK — Authentication

    firebase.auth().onAuthStateChanged(function(user) {
      if (user) {
        var admins = db.collection("users").doc("admins");
        admins.get().catch(() => {
          location.assign("..");
        });
      } else {
        location.assign("..");
      }
    });

    var $logoutButton = document.getElementById("console-logOutButton");
    $logoutButton.onclick = () => {
      firebase.auth().signOut();
    };

  })();

  (() => {
    //BLOCK — Categories

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
          exports.workingCopies.categories = categories;
          resolve(categories);
        }).catch((categoriesError) => {
          reject(categoriesError);
        });
      });
    };

    exports.loadCategories = loadCategories;

  })();


  (() => {
    //BLOCK — Circuits
    var loadCircuits = () => {
      return new Promise((resolve, reject) => {
        var circuitsReference = db.collection("circuits");
        circuitsReference.get().then((circuitDocumentsSnapshot) => {
          var circuitDocuments = circuitDocumentsSnapshot.docs,
            circuits = circuitDocuments.filter((circuitDocumentSnapshot) => circuitDocumentSnapshot.data().category != "deleted")
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
          exports.workingCopies.circuits = circuits;
          resolve(circuits);
        }).catch((circuitsError) => {
          reject(circuitsError);
        });
      });
    };

    exports.loadCircuits = loadCircuits;

  })();

  (() => {
    //BLOCK — categories
    var beginCategoriesView = () => {
        return new Promise((resolve, reject) => {
          exports.loadCircuits().then((circuits) => {
            exports.loadCategories().then((categories) => {
              $categoriesList.innerHTML = "";
              categories.map((category) => {
                  var categoryCode = category.data.category,
                    count = circuits
                    .filter((circuit) => circuit.storedDocument.category == categoryCode)
                    .length;
                  category.count = count;
                  return category;
                })
                .filter((category) => category.data.header)
                .forEach((category) => {
                  $categoriesList.innerHTML += generateCategoryEditRow(category);
                  setTimeout(() => {
                    linkUpCategoryEditRow($categoriesList.querySelector(".console-category-edit-row[data-categoryref='" + category.key + "']"));
                  }, 1);
                });
              resolve();
            }).catch((x) => {
              reject(x);
            });
          }).catch((x) => reject(x));
        });
      },
      generateCategoryEditRow = (category) => {
        return categoryEditRowTemplate
          .replace(/%categoryKey%/g, exports.sanitize(category.key))
          .replace(/%name%/g, exports.sanitize(category.data.header))
          .replace(/%count%/g, exports.sanitize(category.count))
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
            setTimeout(() => {
              linkUpCategoryEditRow(document.querySelector(".console-category-edit-row[data-categoryref='" + newCategoryKey + "']"));
            }, 1);
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
          if ((exports.keysCurrentlyPressed.ShiftLeft ||
              exports.keysCurrentlyPressed.ShiftRight ? false : !confirm("Are you sure you want to delete this category?"))) return;
          var dbRef = db.collection("categories").doc(key)
          dbRef.get().then((dbSnapshot) => {
            var header = dbSnapshot.data().header;
            dbRef.delete();
          });
          $row.parentNode.removeChild($row);
        };

      },
      activateCategoriesView = () => {
        $focusCategoriesButton.disabled = true;
        $focusCategoriesButton.innerText = "Loading...";
        beginCategoriesView().then(() => {
          $prelimContainer.style.display = "none";
          $focusCategoriesButton.disabled = false;
          $focusCategoriesButton.innerText = "Categories";
          $console.setAttribute("class", $console.getAttribute("class").replace(/d-none/g, "d-block"));
        }).catch((x) => console.error(x));
      },
      windDownCategoriesView = () => {
        $prelimContainer.style.display = "block";
        $console.setAttribute("class", $console.getAttribute("class").replace(/d-block/g, "d-none"));
      },
      $categoriesList = document.getElementById("console-categoriesConsole-categoriesList"),
      $console = document.getElementById("console-categoriesConsole"),
      $prelimContainer = document.getElementById("console-prelimContainer"),
      $prelimCategoriesContainer = document.getElementById("console-categoriesContainer"),
      $focusCategoriesButton = document.getElementById("console-focusCategoriesButton"),
      $unfocusCategoriesButton = document.getElementById("console-categoriesConsole-closeButton"),
      categoryEditRowTemplate = document.getElementById("console-template-categoryEditRow").innerHTML;

    $focusCategoriesButton.onclick = activateCategoriesView;
    $unfocusCategoriesButton.onclick = windDownCategoriesView;
  })();

  (() => {
    //BLOCK — Circuit

    var activateCircuitView = () => {
        $focusCircuitsButton.disabled = true;
        $focusCircuitsButton.innerText = "Loading...";
        beginCircuitConsole().catch((x) => console.error(x)).then(() => {
          $prelimContainer.style.display = "none";
          $focusCircuitsButton.innerText = "Circuits";
          $console.style.display = "block";
          $console.setAttribute("class", [].slice.call($console.classList).join(" ").replace("d-none", "d-block"));
        });
      },
      beginCircuitConsole = () => {
        return new Promise((resolve, reject) => {
          var $circuitsList = document.getElementById("console-circuitsConsole-circuitsList");
          $circuitsList.innerHTML = document.getElementById("console-template-newCircuitRow").innerHTML;

          exports.loadCategories().then((categories) => {
            exports.loadCircuits().then((circuits) => {
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
                    exports.sanitize(category.data.category) +
                    "'>" +
                    exports.sanitize(category.data.header ? category.data.header : "[deleted category, formerly " +
                      category.data.formerHeader + "]") +
                    "</option>";
                }).join("");
              })();

              var $createCircuitSelector = $circuitsList.querySelector(".console-circuits-newCircuitRow-category");
              $createCircuitSelector.innerHTML = categoryOptions;


              setTimeout(() => {
                var $createCircuitButton = $circuitsList.querySelector(".console-circuits-newCircuitRow-createButton");
                var $createCircuitSelectorNC = $circuitsList.querySelector(".console-circuits-newCircuitRow-category");;
                $createCircuitButton.onclick = () => {
                  // console.log($createCircuitButton);
                  var category = $createCircuitSelectorNC.value,
                    d = new Date(),
                    newCircuit = {
                      category: category,
                      title: "New Circuit",
                      instructions: "#|New Circuit, " +
                        (d.getYear() + 1900) + "." + ((d.getMonth() + 1) + ".").padStart(3, "0") + ((d.getDate() + "")).padStart(2, "0") +
                        ";disp|New Circuit;tex|Exercise Title|0|60;tex|Break|0|60;"
                    };

                  db.collection("circuits").add(newCircuit).then((newCircuitRef) => {
                      var name = newCircuit.title,
                        circuitKey = newCircuitRef.id,
                        parsedCircuit = consoleCircuits.parseCircuit(newCircuit.instructions),
                        instructions = parsedCircuit.instructions,
                        $createCircuitRow = $createCircuitButton.parentNode.parentNode.parentNode;
                      exports.workingCopies.circuits.push({
                        storedDocument: newCircuit,
                        parsedCircuit: parsedCircuit,
                        circuitID: circuitKey
                      });
                      $createCircuitRow.insertAdjacentHTML("afterend", circuitNameTemplate
                        .replace(/%key%/g, exports.sanitize(circuitKey))
                        .replace(/%name%/g, exports.sanitize(name))
                        .replace(/%options%/g, categoryOptions));
                      var $circuitEditList = [].slice
                        .call(document.getElementsByClassName("console-circuit-edit-list"))
                        .filter(($list) => {
                          return $list.getAttribute("data-circuitKey") == circuitKey;
                        })[0];

                      instructions.forEach((instruction) => {
                        var instructionUUID = instruction.uuid;
                        $circuitEditList.innerHTML += circuitEditRowTemplate
                          .replace(/%instructionType%/g, exports.sanitize(instruction.type))
                          .replace(/%key%/g, exports.sanitize(circuitKey))
                          .replace(/%instructionIndex%/g, exports.sanitize(instruction.uuid));
                        setTimeout(() => {
                          var $selector = document.querySelector(".console-circuit-instruction-instructionType[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(instructionUUID) + "']");
                          $selector.value = instruction.type;
                          $selector.onchange = () => {
                            exports.dataUtilities.handleExerciseTypeChange(circuitKey, instructionUUID, $selector.value);
                          }

                          var $controlsContainer = document.querySelector(".console-circuit-instructionEditor[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(instructionUUID) + "']");
                          $controlsContainer.innerHTML = buildControlsForInstruction(instruction);
                          setTimeout(() => {
                            exports.linkControlsForInstruction($controlsContainer, instruction, circuitKey);
                          }, 1);

                          var $addButton = document.querySelector(".console-circuit-instruction-addButton[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(instructionUUID) + "']");
                          $addButton.onclick = () => {
                            exports.dataUtilities.insertExercise(circuitKey, instructionUUID);
                          };

                          var $deleteButton = document.querySelector(".console-circuit-instruction-deleteButton[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(instructionUUID) + "']");
                          $deleteButton.onclick = () => {
                            exports.dataUtilities.deleteExercise(circuitKey, instructionUUID, $deleteButton.parentNode.parentNode.parentNode.parentNode.parentNode);
                          };

                          setTimeout(() => {
                            document.querySelector(".console-circuit-categorySelect[data-circuitKey='" + circuitKey + "']").value = newCircuit.category;
                          }, 1);

                          setTimeout(() => resolveAllCircuitRows(), 1);
                        }, 1);
                      });
                    })
                    .catch((x) => console.error(x));
                };
              }, 1);

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
      resolveAllCircuitRows = () => {
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
              if ((exports.keysCurrentlyPressed.ShiftLeft ||
                  exports.keysCurrentlyPressed.ShiftRight ? false : !confirm("Are you sure you want to delete this circuit?"))) return;
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
                "header": textToRename
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
                var workingCopy = (() => exports.workingCopies.circuits.map((circuit, i) => [i, circuit]).filter((circuit) => circuit[1].circuitID == key)[0][1])();
                $editButton.disabled = true;
                exports.dataUtilities.writeCircuit(workingCopy).then(() => {
                  $editButton.innerText = "Edit";
                  $editButton.disabled = false;
                  $editButton.setAttribute("class", $editButton.getAttribute("class").replace(/btn-success/g, "btn-primary"))
                  $circuitEditList.setAttribute("class", classes.replace(/d-block/g, "d-none"));
                });
              }
            };
          });
      },
      createCircuitRow = ($circuitsList, circuit, categoryOptions) => {
        var name = circuit.storedDocument.title,
          circuitKey = circuit.circuitID,
          instructions = circuit.parsedCircuit.instructions;

        $circuitsList.innerHTML += circuitNameTemplate
          .replace(/%key%/g, exports.sanitize(circuitKey))
          .replace(/%name%/g, exports.sanitize(name))
          .replace(/%options%/g, categoryOptions);

        setTimeout(() => {
          document.querySelector(".console-circuit-categorySelect[data-circuitKey='" + circuitKey + "']").value = circuit.storedDocument.category;
        }, 1);
        var $circuitEditList = [].slice
          .call(document.getElementsByClassName("console-circuit-edit-list"))
          .filter(($list) => {
            return $list.getAttribute("data-circuitKey") == circuitKey;
          })[0];

        instructions.forEach((instruction) => {
          var instructionUUID = instruction.uuid;
          $circuitEditList.innerHTML += circuitEditRowTemplate
            .replace(/%instructionType%/g, exports.sanitize(instruction.type))
            .replace(/%key%/g, exports.sanitize(circuitKey))
            .replace(/%instructionIndex%/g, exports.sanitize(instruction.uuid));
          setTimeout(() => {
            var $selector = document.querySelector(".console-circuit-instruction-instructionType[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(instructionUUID) + "']");
            $selector.value = instruction.type;
            $selector.onchange = () => {
              exports.dataUtilities.handleExerciseTypeChange(circuitKey, instructionUUID, $selector.value);
            }

            var $controlsContainer = document.querySelector(".console-circuit-instructionEditor[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(instructionUUID) + "']");
            $controlsContainer.innerHTML = buildControlsForInstruction(instruction);
            setTimeout(() => {
              exports.linkControlsForInstruction($controlsContainer, instruction, circuitKey);
            }, 1);

            var $addButton = document.querySelector(".console-circuit-instruction-addButton[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(instructionUUID) + "']");
            $addButton.onclick = () => {
              exports.dataUtilities.insertExercise(circuitKey, instructionUUID);
            };

            var $deleteButton = document.querySelector(".console-circuit-instruction-deleteButton[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(instructionUUID) + "']");
            $deleteButton.onclick = () => {
              exports.dataUtilities.deleteExercise(circuitKey, instructionUUID, $deleteButton.parentNode.parentNode.parentNode.parentNode.parentNode);
            };

          }, 1);
        });
      },
      linkControlsForInstruction = ($instructionControls, instruction, circuitKey) => {
        var instructionType = instruction.type,
          uuid = instruction.uuid,
          findIndices = () => {
            var workingCopy = (() => exports.workingCopies.circuits.map((circuit, i) => [i, circuit]).filter((circuit) => circuit[1].circuitID == circuitKey)[0])(),
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
              exports.workingCopies
                .circuits[indices.workingCopyIndex]
                .parsedCircuit
                .instructions[indices.instructionIndex].data = $control.value;
            };
            break;
          case "repExercise":
            var $controls = [".console-circuit-instruction-control-name", ".console-circuit-instruction-control-reps"].map((el) => $instructionControls.querySelector(el));
            $controls.forEach(($control, i) => {
              $control.oninput = () => {
                var indices = findIndices();
                exports.workingCopies
                  .circuits[indices.workingCopyIndex]
                  .parsedCircuit
                  .instructions[indices.instructionIndex]
                  .data[i == 0 ? "exerciseName" : "reps"] = $control.value;
              };
            });
            break;
          case "timedExercise":
            var $controls = ["console-circuit-instruction-control-name", "console-circuit-instruction-control-length"].map((el) => $instructionControls.getElementsByClassName(el)[0]);
            $controls.forEach(($control, i) => {
              $control.oninput = () => {
                var indices = findIndices();
                exports.workingCopies
                  .circuits[indices.workingCopyIndex]
                  .parsedCircuit
                  .instructions[indices.instructionIndex]
                  .data[i == 0 ? "exerciseName" : "length"] = (i == 0 ? $control.value : parseInt($control.value));
              };
            });

            break;
        }
      },
      buildControlsForInstruction = (instruction) => {
        var instructionType = instruction.type,
          template = tokenTemplates[instructionType];
        switch (instructionType) {
          case "interruption":
            return template;
            break;
          case "comment":
          case "displayName":
            return template.replace(/%data%/g, exports.sanitize(instruction.data));
            break;
          case "repExercise":
            return template
              .replace(/%exerciseName%/g, exports.sanitize(instruction.data.exerciseName))
              .replace(/%exerciseReps%/g, exports.sanitize(instruction.data.reps));
            break;
          case "timedExercise":
            return template
              .replace(/%exerciseName%/g, exports.sanitize(instruction.data.exerciseName))
              .replace(/%exerciseLength%/g, exports.sanitize(instruction.data.length));
        }
      },
      deactivateCircuitView = () => {
        $prelimContainer.style.display = "block";
        $console.setAttribute("class", [].slice.call($console.classList).join(" ").replace("d-block", "d-none"));
        $focusCircuitsButton.disabled = false;
      },
      $focusCircuitsButton = document.getElementById("console-focusCircuitsButton"),
      $closeCircuitsButton = document.getElementById("console-circuitsConsole-closeButton"),
      $circuitsContainer = document.getElementById("console-circuitsContainer"),
      $console = document.getElementById("console-circuitsConsole"),
      $prelimContainer = document.getElementById("console-prelimContainer"),
      circuitNameTemplate = document.getElementById("console-template-circuitName").innerHTML,
      circuitEditRowTemplate = document.getElementById("console-template-circuitEditRow").innerHTML,
      tokenTemplates = (() => {
        var tokens = []
        var commandTokens = consoleCircuits.commandTokens;
        for (tokenName in commandTokens) {
          tokens.push(tokenName);
        }
        var templates = {};
        tokens.forEach((token) => {
          templates[token] = document.getElementById("console-template-" + token + "InstructionRow").innerHTML;
        });
        return templates;
      })(),
      $otherContainers = ["console-categoriesContainer", "console-categorySpacer"].map((el) => {
        return document.getElementById(el);
      });

    $focusCircuitsButton.onclick = activateCircuitView;
    $closeCircuitsButton.onclick = deactivateCircuitView;

    exports.buildControlsForInstruction = buildControlsForInstruction;
    exports.linkControlsForInstruction = linkControlsForInstruction;

  })();

  (() => {
    //BLOCK — Data Utilities
    exports.dataUtilities = {
      insertExercise: (circuitKey, uuidBefore) => {
        var workingCopy = (() => exports.workingCopies.circuits.map((circuit, i) => [i, circuit]).filter((circuit) => circuit[1].circuitID == circuitKey)[0])(),
          instructions = workingCopy[1].parsedCircuit.instructions,
          $elementAfter = document.querySelector(".console-circuit-instruction-row[data-circuitkey='" + circuitKey + "'][data-instructionindex='" + uuidBefore + "']"),
          newUUID = consoleCircuits.generateUUID(),
          toInsert = document
          .getElementById("console-template-circuitEditRow")
          .innerHTML
          .replace(/%instructionType%/g, "interruption")
          .replace(/%key%/g, exports.sanitize(circuitKey))
          .replace(/%instructionIndex%/g, exports.sanitize(newUUID));
        var arrayBeforeIndex = (() => {
          return instructions.map((instruction, i) => [i, instruction]).filter((instruction) => {
            return instruction[1].uuid == uuidBefore;
          })[0];
        })()[0];
        instructions.splice(arrayBeforeIndex + 1, 0, {
          type: "interruption",
          uuid: newUUID
        });
        exports.workingCopies.circuits[workingCopy[0]].parsedCircuit.instructions = instructions;
        $elementAfter.insertAdjacentHTML("afterend", toInsert);
        setTimeout(() => {
          var $selector = document.querySelector(".console-circuit-instruction-instructionType[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(newUUID) + "']");
          $selector.value = "interruption";
          $selector.onchange = () => {
            exports.dataUtilities.handleExerciseTypeChange(circuitKey, newUUID, $selector.value);
          }
          var $addButton = document.querySelector(".console-circuit-instruction-addButton[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(newUUID) + "']");
          $addButton.onclick = () => {
            exports.dataUtilities.insertExercise(circuitKey, newUUID);
          };

          var $deleteButton = document.querySelector(".console-circuit-instruction-deleteButton[data-circuitkey='" + exports.sanitize(circuitKey) + "'][data-instructionindex='" + exports.sanitize(newUUID) + "']");
          $deleteButton.onclick = () => {
            exports.dataUtilities.deleteExercise(circuitKey, newUUID, $deleteButton.parentNode.parentNode.parentNode.parentNode.parentNode);
          };
        }, 1);
      },
      deleteExercise: (circuitKey, uuid, $instructionRow) => {
        var workingCopy = (() => exports.workingCopies.circuits.map((circuit, i) => [i, circuit]).filter((circuit) => circuit[1].circuitID == circuitKey)[0])(),
          instructions = workingCopy[1].parsedCircuit.instructions,
          arrayIndex = (() => {
            return instructions.map((instruction, i) => [i, instruction]).filter((instruction) => {
              return instruction[1].uuid == uuid;
            })[0][0];
          })();
        if(instructions.length == 1) {
          alert("Cannot delete the last exercise, sorry!");
          return;
        }
        instructions.splice(arrayIndex, 1);
        $instructionRow.parentNode.removeChild($instructionRow);
      },
      handleExerciseTypeChange: (circuitKey, uuid, newType) => {
        var workingCopy = (() => exports.workingCopies.circuits.map((circuit, i) => [i, circuit]).filter((circuit) => circuit[1].circuitID == circuitKey)[0])(),
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

        $circuitEditor.innerHTML = exports.buildControlsForInstruction(instructions[arrayIndex]);

        setTimeout(() => {
          exports.linkControlsForInstruction($circuitEditor, instructions[arrayIndex], circuitKey);
        }, 1);

        exports.workingCopies.circuits[workingCopy[0]].parsedCircuit.instructions = instructions;
      },
      writeCircuit: (workingCopy) => {
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

  window.consoleExports = exports;

})();
