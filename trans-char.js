/**	Perform standard point buy method for character abilities.
 */
 
export class TransformCharacter {
	
	/**	If tokens are targeted add them to the list of summons that can
	 *	be performed. If nothing is targeted, put up a dialog to allow
	 *	the user to choose which actor to summon, and the number to summon.
	 */

	COMPENDIUM_KEY = "swade-core-rules.swade-specialabilities";
	
	async manageSummons(actor) {
		let summons = actor.getFlag('trans-char', 'summons');
		if (!summons)
			summons = [];

		let content=`<div><div>
			<p>Click Remove to remove the selected actor from the list.</p>
			<p>Enter an actor UUID and click Add to add the actor to the Summon list.</p>
			<p>Click Add Targets to add the targeted tokens to the Summon list.</p>
			<p><label>Actors </label> <select id="summon">\n`;

		// List available summons and delete missing actors from the list.

		let newSummons = [];

		for (let s of summons) {
			const a = await fromUuid(s.uuid);
			if (!a) {
				ui.notifications.warn(`${s.name} no longer exists and cannot be summoned.`);
				continue;
			}

			content += `<option value="${s.uuid}">${s.name}</option>\n`;
			newSummons.push(s);
		}

		if (summons.length != newSummons.length) {
			actor.setFlag('trans-char', 'summons', newSummons);
			summons = newSummons;
		}
		
		content += `</select></p>
			<p><label>UUID of New Summon: <input id="newsummon" type="text"></label></p>
		</div></div>`;

		await foundry.applications.api.DialogV2.wait({
			window: {
				title: "Manage Summons",
				position: {
					width: 300,
					height: 500
				}
			},
			modal: false,
			content: content,
			buttons: [
				{
					action: "remove",
					label: "Remove",
					callback: async (event, button, dialog) => {
						const uuid = button.form.elements.summon.value;
						let i = summons.findIndex(s => s.uuid == uuid);
						if (i >= 0) {
							summons.splice(i, 1);
							actor.setFlag('trans-char', 'summons', summons);
							const a = game.actors.get(uuid);
							ui.notifications.notify(`${a.name} removed from summon list.`);
						}
					}
				},
				{
					action: "add",
					label: "Add",
					callback: async (event, button, dialog) => {
						const uuid = button.form.elements.newsummon.value;
						const a = await fromUuid(uuid);
						if (!a) {
							ui.notifications.warn(`No actor found for UUID ${uuid}`);
							return;
						}
						if (!(a instanceof Actor)) {
							ui.notifications.warn(`UUID ${uuid} (${a.name}) is not an Actor.`);
							return;
						}
						let i = summons.findIndex(s => s.uuid == uuid);
						if (i > 0) {
							ui.notifications.warn(`UUID ${uuid} (${a.name}) is already in the list`);
							return;
						}
						summons.push({name: a.name, uuid: uuid});
						actor.setFlag('trans-char', 'summons', summons);
					}
				},
				{
					action: "addTargets",
					label: "Add Targets",
					callback: async (event, button, diaog) => {
						let targets = game.user.targets;
	
						if (targets.size <= 0) {
							ui.notifications.notify(`First target tokens that you wish to add to the list.`);
							return;
						}
						let added = "";
						for (let t of targets) {
							let uuid = 'Actor.' + t.document.actorId;
							
							if (summons.find(s => s.uuid == uuid))
								continue;
							summons.push({name: t.actor.name, uuid: uuid});
							if (added)
								added += ', ';
							added += t.actor.name;
						}
						actor.setFlag('trans-char', 'summons', summons);

						if (added)
							ui.notifications.notify(`Actors added to Summon list: ${added}.`);
						else
							ui.notifications.notify(`All targeted actors were already in the summons list.`);
					}
				},
				{
					action: "cancel",
					label: "Cancel",
					callback: (event, button, dialog) => null
				}
			]
		});		
	}
	

	async summon(token) {
		let summonEffect = {
			name: "Summon Ally",
			icon: "modules/trans-char/icons/summon.jpg",
			origin: null,
			disabled: false,
			duration: {
			  seconds: 24,
			  rounds: 4,
  			  startTime: game.time.worldTime,
			  startRound: game?.combat?.current?.round
			},
			system: {
				expiration: 2
			},
			description: "<p>Summoned Ally</p>"
		};

		if (!token) {
			ui.notifications.warn('A token must be selected to perform the summon.');
			return;
		}
		
		let actor = token.actor;

		let summons = actor.getFlag('trans-char', 'summons');
		if (!summons)
			summons = [];

		let content=`<div><div>
			<p>To summon an actor select it in the Actor dropdown list and click Summon.</p>
			<p>To delete summoned tokens and actors click Delete Summoned.</p>
			<p>To add/remove actors from the Actor list click Manage.</p>
			<p><label>Actor </label> <select id="summon">\n`;

		// List available summons and delete missing actors from the list.

		let newSummons = [];

		for (let s of summons) {
			const a = fromUuid(s.uuid);
			if (!a) {
				ui.notifications.warn(`${s.name} no longer exists and cannot be summoned.`);
				continue;
			}

			content += `<option value="${s.uuid}">${s.name}</option>\n`;
			newSummons.push(s);
		}

		if (summons.length != newSummons.length) {
			actor.setFlag('trans-char', 'summons', newSummons);
			summons = newSummons;
		}
		
		content += `<option value="mirror">Mirror Self</option>\n`;

		content += `</select></p>
			<p><label>Number to summon: <input type="number" id="number" name="number" min="1" value="1" width="20"/></label></p>
			<p><label><input type="checkbox" id="raise" name="raise"> Raise</label></p>
		</div></div>`;

		await foundry.applications.api.DialogV2.wait({
			window: {
				title: "Summon",
			  position: {
				  width: 300,
				  height: 500
			  }
			},
			modal: false,
			content: content,
			buttons: [
				{
					action: "ok",
					label: "Summon",
					callback: async (event, button, dialog) => {
						const uuid = button.form.elements.summon.value;
						let number = button.form.elements.number.value;

						summonEffect.origin =`Actor.${actor.id}`;

						if (uuid == 'mirror') {
							summonEffect.name = `Summon Ally Mirror Self`;
							await actor.createEmbeddedDocuments("ActiveEffect", [summonEffect]);
							this.mirrorSelf(token, button.form.elements.raise.checked, number, summonEffect);
							return;
						}

						// Find the source actor from the UUID
						let source = await fromUuid(uuid);
						if (!source) {
							ui.notifications.warn(`Actor for UUID ${uuid} no longer exists.`);
							return;
						}
						if (!(source instanceof Actor)) {
							ui.notifications.warn(`UUID ${uuid} is not an Actor.`);
							return;
						}

						// Create a new actor and mark it as summoned so it can be deleted easily.

						let summonData = source.toObject();

						summonData.ownership = actor.ownership;
						summonData.type = 'npc';
						summonData.folder = await this.getSummonFolderId();
						let summoned = await Actor.create(summonData);
						
						if (!summoned) {
							ui.notifications.warn(`Unable to create ${summonData.name}`);
							return;
						}
						summoned.setFlag('trans-char', 'expiration', {
							summoned: true,
							sourceActorId: actor.id,
							expires: game.time.worldTime + 30
						});

						summonEffect.name = `Summon Ally ${summoned.name}`;
						await actor.createEmbeddedDocuments("ActiveEffect", [summonEffect]);

						let tokens = [];
						for (let i = 1; i <= number; i++) {
							tokens.push(await summoned.getTokenDocument({
								disposition: token.document.disposition,
								actorLink: false,
								x: token.x + i*canvas.grid.sizeX,
								y: token.y
							}));
						}

						let tokenList = await canvas.scene.createEmbeddedDocuments('Token', tokens);

						for (const t of tokenList) {
							if (button.form.elements.raise.checked)
								this.addItems(this.COMPENDIUM_KEY, t.actor, ["Resilient"]);
							// Summoned actors aren't wildcards.
							await t.actor.update({
								"system.wounds.max": 0,
								"system.wounds.value": 0,
								"system.fatigue.value": 0,
								"system.bennies.value": 0,
								"system.bennies.max": 0
							});
							t.actor.setFlag('trans-char', 'expiration', {
								summoned: true,
								sourceActorId: actor.id,
								expires: game.time.worldTime + 30
							});
							await t.actor.createEmbeddedDocuments("ActiveEffect", [summonEffect]);	
						}
						const msg = `${actor.name} summoned ${number==1?'': number + ' '}${summoned.name}${number==1?'':'s'}.`;
						let chatData = {content: msg};
						if (game.user.isGM && token.document.disposition != CONST.TOKEN_DISPOSITIONS.FRIENDLY)
							chatData.whisper = [game.user._id];
						await ChatMessage.create(chatData);	
					}
				},
				{
					action: "delete",
					label: "Delete Summoned",
					callback: async (event, button, dialog) => { this.cleanup(actor) }
				},
				{
					action: "manage",
					label: "Manage",
					callback: async (event, button, dialog) => {
						this.manageSummons(actor);
					}
				},
				{
					action: "cancel",
					label: "Cancel",
					callback: (event, button, dialog) => null
				}
			]
		});
	}

	async getSummonFolderId() {
		const folderName = "Summoned Actors";

		// Check if the folder already exists
		let folder = game.folders.find(f => f.name === folderName && f.type === "Actor");
		if (folder)
			return folder.id;

		// If not, create it
		folder = await Folder.create({
			name: folderName,
			type: "Actor",
			parent: null
		});
		console.log(`Created folder: ${folderName}`);
		return folder.id;
	}

	async cleanup(summoner) {
		let names = '';
		let ids = [];
		for (let t of canvas.scene.tokens) {
			const expiration = t.actor.getFlag('trans-char', 'expiration');
			if (expiration && expiration.summoned && expiration.sourceActorId == summoner.id) {
				ids.push(t.id);
				if (names)
					names += ', ';
				names += t.name;
			}
		}
		let actors = game.actors.filter(a => {
			const e = a.getFlag('trans-char', 'expiration');
			return e && e.summoned && e.sourceActorId == summoner.id;
		});
		let actorNames = '';
		for (let a of actors) {
			if (actorNames)
				actorNames += ', ';
			actorNames += a.name;
		}
		let list = '';
		if (names)
			list += `Tokens: ${names}</br>`;
		if (actorNames)
			list += `Actors: ${actorNames}</br>`;
		if (!list)
			list = "None found";

		await foundry.applications.api.DialogV2.wait({
			window: { title: "Delete Summoned Actors?" },
			content: `<p>This will delete the following summoned tokens and actors:</p><p>` + list + '</p>',
			buttons: [
				{
					action: "ok",
					label: "Yes",
					callback: async (event, button, dialog) => {
						if (ids.length > 0)
							await canvas.scene.deleteEmbeddedDocuments('Token', ids);
						console.log('trans-char | deleting ' + names + '|' + actorNames);
						for (let a of actors)
							a.delete();
						let effects = summoner.effects.filter(e => e.name.startsWith("Summon Ally"));
						if (effects.length > 0) {
							summoner.deleteEmbeddedDocuments("ActiveEffect", effects.map(e => e.id));
						}
					}
				},
				{
					action: "cancel",
					label: "No",
					callback: (event, button, dialog) => {}
				}
			]
		});
	}
	
	async addItems(packName, actor, itemNames) {
		// Load the compendium

		const pack = game.packs.get(packName);
		if (!pack) {
			ui.notifications.error(`Compendium not found: ${packName}`);
			return false;
		}

		let items = [];

		for (let name of itemNames) {
			const entry = pack.index.find(e => e.name === name);

			if (!entry) {
				ui.notifications.error(`"${name}" not found in compendium.`);
				return false;
			}

			// Load full item document
			const itemDoc = await pack.getDocument(entry._id);

			// Duplicate the item data
			const itemData = itemDoc.toObject();
			delete itemData._id;
			items.push(itemData);
		}

		// Create the items on the actor

		await actor.createEmbeddedDocuments("Item", items);
		return true;
	}

	async mirrorSelf(token, raise, number, summonEffect) {
		if (!token) {
		  ui.notifications.error('No token selected.')
		  return;
		} 
		const actor = token.actor;
		if (!actor) {
		  ui.notifications.error('No actor is associated with that token.')
		  return;
		}

		const MIN_SKILL_DIE = 4;

		// Utility: reduce die type by one step (min d4)
		function downgradeDie(die) {
		  const dice = [4, 6, 8, 10, 12];
		  const idx = dice.indexOf(die);
		  return dice[Math.max(0, idx - 1)];
		}

		// Clone actor data

		let cloneData = foundry.utils.duplicate(actor.toObject());
		cloneData._id = cloneData.id = null;
		//cloneData.folder = this.getSummonFolderId();

		const isNPC = actor.type == 'npc' || token.document.disposition != 1;
		if (isNPC)
		  cloneData.name = actor.name;
		else
		  cloneData.name = `Mirror ${actor.name}`;

		// Make the clone an Extra and junk all the temporary
		// effects.

		cloneData.type = 'npc';
		cloneData.system.wildcard = false;
		cloneData.system.wounds.max = 0;
		cloneData.system.wounds.value = 0;
		cloneData.system.fatigue.value = 0;
		cloneData.system.bennies.value = 0;
		cloneData.system.bennies.max = 0;

		cloneData.system.details.archetype = 'Mirror';

		cloneData.effects = [];

		// Reduce skills by one die type (attributes unchanged)

		for (const [skillId, skill] of Object.entries(cloneData.items ?? {})) {
		  if (skill.type === "skill") {
			const die = skill.system.die?.sides;
			if (die) {
			  const newDie = downgradeDie(die);
			  skill.system.die.sides = newDie;
			}
		  }
		}

		// Remove Summon Ally power

		cloneData.items = cloneData.items.filter(i =>
		  !(i.type === "power" && i.system.swid == 'summon-ally')
		);

		// Remove magic items.

		cloneData.items = cloneData.items.filter(i =>
		  !(i.flags['swade-make-magic']?.isMagic || i.system.category == 'Magic Item')
		);

		// Create the clone actor
		let cloneActor = await Actor.create(cloneData);
		await cloneActor.setFlag('trans-char', 'expiration', {
			summoned: true,
			sourceActorId: actor.id,
			expires: game.time.worldTime + 30
		});


		// Add Construct + Fearless abilities and Resilient if raise.

		let itemNames = ['Construct', 'Fearless'];

		if (raise)
			itemNames.push('Resilient');

		this.addItems(this.COMPENDIUM_KEY, cloneActor, itemNames);

		// Spawn token(s) near caster.
		
		for (let i = 1; i <= number; i++) {
			const spawnX = token.x + i * canvas.grid.size;
			const spawnY = token.y;

			let newToken = await TokenDocument.create({
				name: isNPC ? token.document.name : `Mirror ${token.document.name}`,
				actorId: cloneActor.id,
				actorLink: false,
				bar1: token.document.bar1,
				bar2: token.document.bar2,
				displayBars: token.document.displayBars,
				displayName: token.document.displayName,
				lockedRotation: token.document.lockedRotation,
				texture: token.document.texture,
				x: spawnX,
				y: spawnY,
				hidden: false,
				disposition: token.document.disposition
			}, { parent: canvas.scene });

			if (summonEffect)
				await newToken.actor.createEmbeddedDocuments("ActiveEffect", [summonEffect]);

			// If PC flip the token in the X direction to indicate it's the mirror to help player
			// know which is which.
			// Don't do this for NPCs to make it hard for players to figure out which is
			// the mirror.

			if (!isNPC)
				newToken.update({"texture.scaleX": -token.document.texture.scaleX});
		}
		const msg = `${actor.name} summoned ${number==1?'': number + ' '}${cloneActor.name}${number==1?'':'s'}.`;
		let chatData = {content: msg};
		if (game.user.isGM && token.document.disposition != CONST.TOKEN_DISPOSITIONS.FRIENDLY)
			chatData.whisper = [game.user._id];
		await ChatMessage.create(chatData);
	}

	async transform(token) {
		if (!token) {
			ui.notifications.warn('You must select an actor to transform.');
			return;
		}
		let actor = token.actor;
		let target = game.user.targets.first();
	
		let tActor = null;
		if (target) {
			// If targeting yourself just transform back.
			tActor = target.actor;
			if (tActor.uuid == actor.uuid)
				target = null;
			if (!game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.SHIFT))
				target = null;
		}

		if (!target) {
			let targetUuid = actor.getFlag('trans-char', 'uuid');
			if (!targetUuid) {
				ui.notifications.warn('You must select a target token to transform into. Target the token and hold Shift, then execute the Transform macro.');
				return;
			}
			let [str, uuid] = targetUuid.split('.');
			tActor = game.actors.get(uuid);
			if (!tActor) {
				ui.notifications.warn('The previously selected actor does not exist.');
				return;
			}
		} else {
			const confirmation = await Dialog.confirm({
			  title: "Perform Transformation?",
			  content: `<p>Transform ${actor.name} into ${tActor.name}?</p><p></p>`,
			  yes: (html) => { return true; },
			  no: (html) => { return false; },
			});			
			if (!confirmation)
				return;
			
			await actor.setFlag('trans-char', 'uuid', tActor.uuid);
			await tActor.setFlag('trans-char', 'uuid', actor.uuid);
		}
		console.log(`trans-char | ${actor.name} => ${tActor.name}`);
		await tActor.update({"system.bennies.value": actor.system.bennies.value,
			"system.fatigue.value": actor.system.fatigue.value,
			"system.wounds.value": actor.system.wounds.value});
		if (actor.system.status.isShaken != tActor.system.status.isShaken) {
			const shaken = game.swade.util.getStatusEffectDataById('shaken', {active: actor.system.status.isShaken});
			await tActor.toggleActiveEffect(shaken);
		}
		let stat;
		if (actor.system.isIncapacitated != tActor.system.isIncapacitated) {
			stat = game.swade.util.getStatusEffectDataById('incapacitated', {active: actor.system.isIncapacitated});
			await tActor.toggleActiveEffect(stat);
		}
		if (actor.system.status.isStunned != tActor.system.status.isStunned) {
			stat = game.swade.util.getStatusEffectDataById('stunned', {active: actor.system.status.isStunned});
			await tActor.toggleActiveEffect(stat);
		}
		if (actor.system.status.isBound != tActor.system.status.isBound) {
			stat = game.swade.util.getStatusEffectDataById('bound', {active: actor.system.status.isBound});
			await tActor.toggleActiveEffect(stat);
		}
		if (actor.system.status.isEntangled != tActor.system.status.isEntangled) {
			stat = game.swade.util.getStatusEffectDataById('entangled', {active: actor.system.status.isEntangled});
			await tActor.toggleActiveEffect(stat);
		}
		if (actor.system.status.isDistracted != tActor.system.status.isDistracted) {
			stat = game.swade.util.getStatusEffectDataById('distracted', {active: actor.system.status.isDistracted});
			await tActor.toggleActiveEffect(stat);
		}
		if (actor.system.status.isVulnerable != tActor.system.status.isVulnerable) {
			stat = game.swade.util.getStatusEffectDataById('vulnerable', {active: actor.system.status.isVulnerable});
			await tActor.toggleActiveEffect(stat);
		}

		let tDoc = null;
		if (!target) {
			// Create a token for the transformed actor and delete the current token.
			tDoc = await tActor.getTokenDocument({ x: token.x, y: token.y });
			let targets = await canvas.scene.createEmbeddedDocuments('Token', [tDoc]);
			target = targets[0];
		} else {
			// Move the token transformed into to the current token's location.
			target.document.update({"x": token.x, "y": token.y});
			tDoc = target.document;
		}
		await this.swapTokensInCombat(token, target);
		ChatMessage.create({
			content: `${token.name} has transformed into ${target.name}.`
		});
		await canvas.scene.deleteEmbeddedDocuments('Token', [token.id]);
	}

    async swapTokensInCombat(currentToken, newToken) {
        let combats = game.combats.filter(c => c.combatants.find(c => c.tokenId == currentToken.id));
        if (combats.length > 0) {
            let combatUpdateData = [];
            for (let combat of combats) {
                let combatants = combat.combatants.filter(c => c.tokenId == currentToken.id);
                let combatantUpdateData = [];
                for (let combatant of combatants) {
                    combatantUpdateData.push({
                        _id: combatant.id,
                        tokenId: newToken.id,
                        sceneId: currentToken.parent.id,
                        actorId: newToken.actor.id,
                    });
                }

                combatUpdateData.push({
                    combatId: combat.id,
                    combatantUpdateData: combatantUpdateData,
                });
            }
            await game.swadeShapeChanger.socket.executeAsGM("updateCombatant", combatUpdateData);
		}
	}

	async healTarget() {
		if (game.user.targets.size != 1) {
		  ui.notifications.warn('You must target exactly one token to heal.');
		  return;
		}

		let token = game.user.targets.first();
		if (token.actor.system.wounds.value <= 0) {
			ui.notifications.notify(`${token.name} has no wounds to heal.`);
			return;
		}

		await TransformCharacter.socket.executeAsGM("healTargetGM", game.user.id, token.scene._id, token.id);
	}

	static {
		console.log("trans-char | Swade Transform character loaded.");

		Hooks.on("init", function() {
			console.log("trans-char | Swade Transform character initialized.");
			if (!game.swadeTransformChar) {
				game.swadeTransformChar = new TransformCharacter();
				CONFIG.TransformChar = {transform: game.swadeTransformChar.transform};
			}
		});

		Hooks.on("ready", function() {
		  console.log("trans-char | Swade Transform character ready to accept game data.");
		});

		let socket;
		
		Hooks.once("socketlib.ready", () => {
			TransformCharacter.socket = socketlib.registerModule("trans-char");
			TransformCharacter.socket.register("healTargetGM", healTargetGM);
		});

		function healTargetGM(playerID, sceneID, tokenID) {
			let scene = game.scenes.get(sceneID);
			let token = scene.tokens.get(tokenID);
			let actor = token.actor;

			console.log(`trans-char | Healing ${token.name}`);
			const wounds = 1;
			const currentWounds = actor.system.wounds.value
			const newWounds = Math.max(currentWounds - wounds, 0)
			if (newWounds <= actor.system.wounds.max) {
				actor.update({"system.wounds.value": newWounds})
				let chatData = {
					user: playerID,
					content: `${token.name} healed for one wound.`
				};
				ChatMessage.create(chatData);
								
				let effects = actor.effects.filter(e => e.name === "Incapacitated" || e.name === "Defeated" );
				if (effects.length > 0) {
					actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(e => e.id));
				}
			}
		}
	}
}

