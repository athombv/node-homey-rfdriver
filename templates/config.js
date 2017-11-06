'use strict';

module.exports = {
	generic: {
		imitate: {
			version: '1.0.0',
			template: './generic/imitate.html',
			options: {
				navigation: {
					prev: true,
					next: false,
				},
			},
			locales: {
				en: {
					generator: {
						pair: {
							imitate: {
								title: {
									default: 'Copy your remote signal',
									remote: 'Identify your remote',
									wall_switch: 'Identify your wall switch',
								},
								body: {
									default: 'Click the button on your remote that is paired to your device.',
									blinds: 'Press the up/down button on the remote that is paired to your blinds.',
									remote: 'Click a button on your remote to pair it.',
									wall_switch: 'Press a random button on your wall switch to pair it.',
									socket: 'Press the button that is paired to your socket.',
								},
							},
						},
					},
				},
				nl: {
					generator: {
						pair: {
							imitate: {
								title: {
									default: 'Kopieer het signaal van de afstandsbediening',
									remote: 'Identificeer de afstandsbediening',
									wall_switch: 'Identificeer de wandschakelaar',
								},
								body: {
									default: 'Druk op de knop op de afstandsbediening waarop het apparaat geprogrammeerd is.',
									blinds: 'Druk op de omhoog/omlaag knop van de afstandsbediening waarmee de zonnewering gekoppeld is.',
									remote: 'Klik op een willekeurige knop op de afstandsbediening om hem te koppelen.',
									wall_switch: 'Klik op een willekeurige knop op de wandschakelaar om hem te koppelen.',
									socket: 'Druk op de knop van de afstandsbediening waarmee het apparaat gekoppeld is.',
								},
							}
						},
					},
				},
			},
		},
		choice: {
			version: '1.0.1',
			template: './generic/choice.html',
			options: {
				navigation: {
					prev: true,
					next: false,
				},
			},
			locales: {
				en: {
					generator: {
						pair: {
							choice: {
								title: {
									default: 'Choose one of the following options',
									switch: 'Copy signal from remote or pair device with Homey',
									codwheel: 'Copy signal from remote or set the codewheels manually',
									dipswitch: 'Copy signal from remote or set the dipswitches manually',
								},
								body: {
									default: 'Click one of the buttons above to proceed.',
									switch: 'Choose if you want to copy an existing signal from a paired remote or if you want to generate a new signal to pair this device.',
									codewheel: 'Choose if you want to copy an existing signal from a paired remote or if you want to set the codewheels manually to pair this device.',
									dipswitch: 'Choose if you want to copy an existing signal from a paired remote or if you want to set the dipswitches manually to pair this device.',
								},
								buttons: {
									copy: {
										default: 'Copy a paired remote',
									},
									generate: {
										default: 'Generate a new signal',
										codewheel: 'Manually set codewheels',
										dipswitch: 'Set the dipswitches',
									},
								},
							},
						},
					},
				},
				nl: {
					generator: {
						pair: {
							choice: {
								title: {
									default: 'Kies een van de volgende opties',
									switch: 'Kopieer de afstandsbediening of programmeer met Homey',
									codwheel: 'Kopieer de afstandsbediening of stel de lettercodeshijfen handmatig in',
									dipswitch: 'Kopieer de afstandsbediening of stel de dipswitches handmatig in',
								},
								body: {
									default: 'Klik op een van de opties om verder te gaan.',
									switch: 'Kies of je het signaal van een gekoppelde afstandsbediening wil kopiëren of dat je het apparaat wil programmeren met een nieuw signaal van Homey.',
									codewheel: 'Kies of je het signaal van een gekoppelde afstandsbediening wil kopiëren of dat je de lettercodeshijf handmatig wil instellen.',
									dipswitch: 'Kies of je het signaal van een gekoppelde afstandsbediening wil kopiëren of dat je de dipswitches handmatig wil instellen.',
								},
								buttons: {
									copy: {
										default: 'Kopieer afstandsbediening',
									},
									generate: {
										default: 'Genereer nieuw signaal',
										codewheel: 'lettercodeshijf instellen',
										dipswitch: 'dipswitches instellen',
									},
								},
							},
						},
					},
				},
			},
		},
		done: {
			version: '1.0.0',
			template: './generic/done.html',
			locales: {
				en: {
					generator: {
						pair: {
							done: {
								title: {
									default: 'Adding device!',
								},
							},
						},
					},
				},
				nl: {
					generator: {
						pair: {
							done: {
								title: {
									default: 'Apparaat wordt toegevoegd!',
								},
							},
						},
					},
				},
			},
		},
		info: {
			version: '1.0.0',
			template: './generic/info.html',
			options: {
				navigation: {
					prev: true,
					next: true,
				},
			},
			locales: {
				en: {
					generator: {
						pair: {
							info: {
								title: {
									default: 'info',
									dipswitch: 'Locate the dipswitches on your device',
									codewheel: 'Locate the codewheels on your device',
								},
								body: {
									default: 'info message',
									dipswitch: 'Locate the dipswitches on your device like displayed above, then click next.',
									codewheel: 'Locate the codewheels on your device like displayed above, then click next.',
								},
							},
						},
					},
				},
				nl: {
					generator: {
						pair: {
							info: {
								title: {
									dipswitch: 'Vind de dipswitches op het apparaat',
									codewheel: 'Vind de lettercodeshijfen op het apparaat',
								},
								body: {
									dipswitch: 'Vind de dipswitches op het apparaat zoals hierboven aangegeven, klik daarna op volgende.',
									codewheel: 'Vind de lettercodeshijfen op het apparaat zoals hierboven aangegeven, klik daarna op volgende.',
								},
							},
						},
					},
				},
			},
		},
		program: {
			version: '1.0.1',
			template: './generic/program.html',
			options: {
				navigation: {
					prev: true,
					next: true,
				},
			},
			locales: {
				en: {
					generator: {
						pair: {
							program: {
								programbutton: {
									default: 'Program',
								},
								title: {
									default: 'Pair your device with Homey',
									socket: 'Put the socket in pairing mode',
								},
								body: {
									default: 'Put your device in pairing mode, then click the \'Program\' button to pair your device with Homey.',
									socket: 'Press the program button on your socket to put it in pairing mode, then click the \'Program\' button.',
								},
							},
						},
					},
				},
				nl: {
					generator: {
						pair: {
							program: {
								programbutton: {
									default: 'Programmeer',
								},
								title: {
									default: 'Programmeer het apparaat met Homey',
									socket: 'Zet de contactdoos in programmeer modus',
								},
								body: {
									default: 'Zet het apparaat in programmeer modus en klik op \'Programmeer\' om het apparaat met Homey te verbinden.',
									socket: 'Houd de programmeer knop van de contactdoos een paar seconden ingehouden om deze in programeer modus te zetten. Klik daarna op de \'Programmeer\' knop.',
								},
							},
						},
					},
				},
			},
		},
		test: {
			version: '1.0.0',
			template: './generic/test.html',
			options: {
				navigation: {
					prev: true,
					next: true,
				},
			},
			locales: {
				en: {
					generator: {
						pair: {
							test: {
								title: {
									default: 'Test your device',
									remote: 'Test your remote',
									wall_switch: 'Test your wall switch',
									socket: 'Test your socket',
								},
								body: {
									default: 'Press a random button on your device or click the button in the image above to test the signal. Press next to continue.',
									remote: 'Press a random button on your remote or click the button in the image above to test the signal. Press next to continue.',
									wall_switch: 'Press a random button on your wall switch or click the buttons in the image above to test the signal. Press next to continue.',
									socket_generated: 'Use the switch above to test your socket. Press next to continue.',
									socket: 'Use your remote or the switch above to test your socket. Press next to continue.',
									button_generated: 'Use the button above to test your device. Press next to continue.',
									button: 'Use your remote or the button above to test your device. Press next to continue.',
									switch_generated: 'Use the switch above to test your device. Press next to continue.',
									switch: 'Use your remote or the switch above to test your device. Press next to continue.',
								},
							},
						},
						settings: (device) => (device.settings || {})
							.reduce((res, obj) => res.concat((obj.type === 'group' ? obj.children : obj) || []), [])
							.some(setting => setting.id === 'rotated') ? ({
							groups: {
								general: 'Algemene Instellingen',
							},
							rotated: {
								0: 'Nee',
								180: 'Ja',
								label: 'Inverteer signaal',
							},
						}) : {},
					},
				},
				nl: {
					generator: {
						pair: {
							test: {
								title: {
									default: 'Test het apparaat',
									remote: 'Test your remote',
									wall_switch: 'Test de wandschakelaar',
									socket: 'Test de contactdoos',
								},
								body: {
									default: 'Druk op een willekeurige knop op het apparaat of op de knoppen in het bovenstaande plaatje om het signaal te testen. Klik op volgende om verder te gaan.',
									remote: 'Druk op een willekeurige knop op de afstandsbediening of op de knoppen in het bovenstaande plaatje om het signaal te testen. Klik op volgende om verder te gaan.',
									wall_switch: 'Druk op een willekeurige knop op de wandschakelaar of op de knoppen in het bovenstaande plaatje om het signaal te testen. Klik op volgende om verder te gaan',
									socket_generated: 'Gebruik te bovenstaande switch om de schakeldoos te testen. Klik op volgende om verder te gaan.',
									socket: 'Gebruik de afstandsbediening of de bovenstaande switch om de schakeldoos te testen. Klik op volgende om verder te gaan.',
									button_generated: 'Gebruik de bovenstaande knop om het apparaat te testen. Klik op volgende om verder te gaan.',
									button: 'Gebruik de afstandsbediening of te bovenstaande knop om het apparaat te testen. Klik op volgende om verder te gaan.',
									switch_generated: 'Gebruik de bovenstaande knop om het apparaat te testen. Klik op volgende om verder te gaan.',
									switch: 'Gebruik de afstandsbediening of de bovenstaande knop om het apparaat te testen. Klik op volgende om verder te gaan.',
								},
							},
						},
						settings: (device) => (device.settings || {})
							.reduce((res, obj) => res.concat((obj.type === 'group' ? obj.children : obj) || []), [])
							.some(setting => setting.id === 'rotated') ? ({
							groups: {
								general: 'General Settings',
							},
							rotated: {
								0: 'No',
								180: 'Yes',
								label: 'Invert signal',
							},
						}) : {},
					},
				},
			},
		},
		test_button: {
			extends: 'test',
			version: '1.0.0',
			template: './generic/test_button.html',
		},
		test_switch: {
			extends: 'test',
			version: '1.0.0',
			template: './generic/test_switch.html',
		},
	},
	ir: {
		model_select: {
			version: '0.1.0',
			template: './ir/model_select.html',
			options: {
				navigation: {
					prev: true,
					next: false,
				},
			},
		},
	},
	433: {
		codewheel: {
			version: '1.0.0',
			template: './433/codewheel.html',
			options: {
				navigation: {
					prev: true,
					next: true,
				},
			},
			locales: {
				en: {
					generator: {
						pair: {
							codewheel: {
								title: {
									default: 'Configure your device code',
								},
								body: {
									default: 'Click the characters on the code wheel above or configure the wheels on the device so they match, then click next.',
								},
							},
						},
					},
				},
				nl: {
					generator: {
						pair: {
							codewheel: {
								title: {
									default: 'Configureer de apparaatcode',
								},
								body: {
									default: 'Klik op de karakters op de bovenstaande lettercodeshijf of pas de lettercodeshijf op het apparaat aan zodat deze gelijk aan elkaar zijn, klik daarna op volgende.',
								},
							},
						},
					},
				},
			},
		},
		dipswitch: {
			version: '1.0.0',
			template: './433/dipswitch.html',
			options: {
				navigation: {
					prev: true,
					next: true,
				},
			},
			locales: {
				en: {
					generator: {
						pair: {
							dipswitch: {
								title: {
									default: 'Configure your device dipswitches',
								},
								body: {
									default: 'Click on the dipswitches above to put them in the same arrangement as those of your device, then click next.',
								},
							},
						},
					},
				},
				nl: {
					generator: {
						pair: {
							dipswitch: {
								title: {
									default: 'Stel de dipswitches van het apparaat in',
								},
								body: {
									default: 'Klik op de bovenstaande dipswitches om ze gelijk aan de dipswitches van het apparaat in te stellen, klik daarna op volgende.',
								},
							},
						},
					},
				},
			},
		},
	},
	868: {},
};
